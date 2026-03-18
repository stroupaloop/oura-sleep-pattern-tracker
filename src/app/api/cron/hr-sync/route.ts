import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hourlyHeartrate, dailyHeartrate, syncLog } from "@/lib/db/schema";
import { ouraFetch } from "@/lib/oura/client";
import type { OuraHeartrateSample } from "@/lib/oura/types";
import { sql } from "drizzle-orm";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";

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
    const hrSamples = await ouraFetch<OuraHeartrateSample>(
      "v2/usercollection/heartrate",
      { start_datetime: `${startDate}T00:00:00`, end_datetime: `${endDate}T23:59:59` }
    );

    if (hrSamples.length === 0) {
      return NextResponse.json({ success: true, records: 0 });
    }

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

    const byDay = new Map<string, OuraHeartrateSample[]>();
    for (const s of hrSamples) {
      const day = s.timestamp.slice(0, 10);
      const arr = byDay.get(day);
      if (arr) arr.push(s);
      else byDay.set(day, [s]);
    }

    for (const [day, samples] of byDay) {
      const bpms = samples.map((s) => s.bpm);
      const restSamples = samples.filter((s) => s.source === "rest");
      const awakeSamples = samples.filter((s) => s.source === "awake");

      await db
        .insert(dailyHeartrate)
        .values({
          day,
          avgBpm: Math.round(avg(bpms) * 10) / 10,
          minBpm: Math.min(...bpms),
          maxBpm: Math.max(...bpms),
          restingBpm: restSamples.length > 0 ? Math.round(avg(restSamples.map((s) => s.bpm)) * 10) / 10 : null,
          awakeBpm: awakeSamples.length > 0 ? Math.round(avg(awakeSamples.map((s) => s.bpm)) * 10) / 10 : null,
          sampleCount: samples.length,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: dailyHeartrate.day,
          set: {
            avgBpm: sql`excluded.avg_bpm`,
            minBpm: sql`excluded.min_bpm`,
            maxBpm: sql`excluded.max_bpm`,
            restingBpm: sql`excluded.resting_bpm`,
            awakeBpm: sql`excluded.awake_bpm`,
            sampleCount: sql`excluded.sample_count`,
          },
        });
    }

    const byDayHour = new Map<string, OuraHeartrateSample[]>();
    for (const s of hrSamples) {
      const etParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        hour12: false,
      }).formatToParts(new Date(s.timestamp));
      const etYear = etParts.find((p) => p.type === "year")!.value;
      const etMonth = etParts.find((p) => p.type === "month")!.value;
      const etDay = etParts.find((p) => p.type === "day")!.value;
      const etHour = parseInt(etParts.find((p) => p.type === "hour")!.value, 10);
      const key = `${etYear}-${etMonth}-${etDay}|${etHour}`;
      const arr = byDayHour.get(key);
      if (arr) arr.push(s);
      else byDayHour.set(key, [s]);
    }

    for (const [key, samples] of byDayHour) {
      const [dayStr, hourStr] = key.split("|");
      const bpms = samples.map((s) => s.bpm);
      const avgBpm = Math.round((bpms.reduce((a, b) => a + b, 0) / bpms.length) * 10) / 10;
      const sources = samples.map((s) => s.source);
      const restCount = sources.filter((s) => s === "rest").length;
      const awakeCount = sources.filter((s) => s === "awake").length;
      const dominantSource = restCount > awakeCount ? "rest" : awakeCount > restCount ? "awake" : "mixed";

      await db
        .insert(hourlyHeartrate)
        .values({
          day: dayStr,
          hour: parseInt(hourStr, 10),
          avgBpm,
          minBpm: Math.min(...bpms),
          maxBpm: Math.max(...bpms),
          sampleCount: samples.length,
          source: dominantSource,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [hourlyHeartrate.day, hourlyHeartrate.hour],
          set: {
            avgBpm: sql`excluded.avg_bpm`,
            minBpm: sql`excluded.min_bpm`,
            maxBpm: sql`excluded.max_bpm`,
            sampleCount: sql`excluded.sample_count`,
            source: sql`excluded.source`,
          },
        });
    }

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
      hourlyBuckets: byDayHour.size,
    });
  } catch (error) {
    console.error("HR sync cron error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
