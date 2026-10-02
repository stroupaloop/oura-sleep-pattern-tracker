import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";
import { loadOuraGrant } from "@/lib/oura/client";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";
import { syncHeartRateWindows } from "@/lib/oura/heartrate-sync";
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
    const result = await syncHeartRateWindows(startDate, endDate, now);

    await db.insert(syncLog).values({
      syncType: "cron-hr",
      startDate,
      endDate,
      recordsFetched: result.samples,
      status: result.warning ? "error" : "success",
      errorMessage: result.warning ? formatOuraSyncWarnings([result.warning]) : null,
      createdAt: now,
    });

    return NextResponse.json(
      { success: !result.warning, ...result },
      { status: result.warning ? 500 : 200 }
    );
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
