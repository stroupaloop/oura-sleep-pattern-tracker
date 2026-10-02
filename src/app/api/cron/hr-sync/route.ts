import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";
import { loadOuraGrant, ouraFetch } from "@/lib/oura/client";
import type { OuraHeartrateSample } from "@/lib/oura/types";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";
import {
  aggregateHeartRateSamples,
  getHeartRateQueryRange,
} from "@/lib/oura/heartrate";
import { upsertHeartRateBuckets } from "@/lib/oura/heartrate-store";
import {
  formatOuraSyncWarnings,
  isOuraDatasetGranted,
  toOuraSyncWarning,
} from "@/lib/oura/contracts";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayStr = getTodayET();
  const startDate = format(subDays(new Date(todayStr + "T12:00:00"), 1), "yyyy-MM-dd");
  const endDate = todayStr;
  const now = Math.floor(Date.now() / 1000);

  try {
    if (!isOuraDatasetGranted(await loadOuraGrant(), "heartrate")) {
      return NextResponse.json({ success: true, records: 0, skipped: "not_granted" });
    }
    const range = getHeartRateQueryRange(startDate, endDate);
    const hrSamples = await ouraFetch<OuraHeartrateSample>(
      "v2/usercollection/heartrate",
      {
        start_datetime: range.startDatetime,
        end_datetime: range.endDatetime,
      },
      // An expired token is refreshed before the request; a 401 after that
      // is a grant problem a refresh cannot fix.
      { refreshUnauthorized: false }
    );

    if (hrSamples.length === 0) {
      await db.insert(syncLog).values({
        syncType: "cron-hr",
        startDate,
        endDate,
        recordsFetched: 0,
        status: "success",
        createdAt: now,
      });
      return NextResponse.json({ success: true, records: 0 });
    }

    const buckets = aggregateHeartRateSamples(hrSamples);
    await upsertHeartRateBuckets(buckets, now);

    await db.insert(syncLog).values({
      syncType: "cron-hr",
      startDate,
      endDate,
      recordsFetched: hrSamples.length,
      status: "success",
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      samples: hrSamples.length,
      hourlyBuckets: buckets.hourly.length,
    });
  } catch (error) {
    const warning = toOuraSyncWarning("heartrate", error);
    await db.insert(syncLog).values({
      syncType: "cron-hr",
      startDate,
      endDate,
      recordsFetched: 0,
      status: "error",
      errorMessage: formatOuraSyncWarnings([warning]),
      createdAt: now,
    });
    console.error("HR sync cron error:", error);
    return NextResponse.json(
      { success: false, error: "Heart-rate sync failed", warning },
      { status: 500 }
    );
  }
}
