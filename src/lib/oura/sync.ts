import { db } from "@/lib/db";
import {
  sleepPeriods,
  dailySleep,
  dailyReadiness,
  syncLog,
} from "@/lib/db/schema";
import { ouraFetch } from "./client";
import type {
  OuraSleepPeriod,
  OuraDailySleep,
  OuraDailyReadiness,
} from "./types";
import { sql } from "drizzle-orm";

export async function syncDateRange(
  startDate: string,
  endDate: string,
  syncType: string
) {
  const now = Math.floor(Date.now() / 1000);
  let totalRecords = 0;

  try {
    const params = { start_date: startDate, end_date: endDate };

    const [sleepData, dailySleepData, readinessData] = await Promise.all([
      ouraFetch<OuraSleepPeriod>("v2/usercollection/sleep", params),
      ouraFetch<OuraDailySleep>("v2/usercollection/daily_sleep", params),
      ouraFetch<OuraDailyReadiness>("v2/usercollection/daily_readiness", params),
    ]);

    for (const s of sleepData) {
      await db
        .insert(sleepPeriods)
        .values({
          id: s.id,
          day: s.day,
          type: s.type,
          bedtimeStart: s.bedtime_start,
          bedtimeEnd: s.bedtime_end,
          totalSleepDuration: s.total_sleep_duration,
          deepSleepDuration: s.deep_sleep_duration,
          lightSleepDuration: s.light_sleep_duration,
          remSleepDuration: s.rem_sleep_duration,
          awakeTime: s.awake_time,
          efficiency: s.efficiency,
          latency: s.latency,
          averageHeartRate: s.average_heart_rate,
          lowestHeartRate: s.lowest_heart_rate,
          averageHrv: s.average_hrv,
          temperatureDelta: s.temperature_delta,
          averageBreath: s.average_breath,
          restlessPeriods: s.restless_periods,
          timeInBed: s.time_in_bed,
          hr5min: s.hr_5min ? JSON.stringify(s.hr_5min) : null,
          hrv5min: s.rmssd_5min ? JSON.stringify(s.rmssd_5min) : null,
          hypnogram5min: s.hypnogram_5min,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: sleepPeriods.id,
          set: {
            totalSleepDuration: sql`excluded.total_sleep_duration`,
            deepSleepDuration: sql`excluded.deep_sleep_duration`,
            lightSleepDuration: sql`excluded.light_sleep_duration`,
            remSleepDuration: sql`excluded.rem_sleep_duration`,
            awakeTime: sql`excluded.awake_time`,
            efficiency: sql`excluded.efficiency`,
            latency: sql`excluded.latency`,
            averageHeartRate: sql`excluded.average_heart_rate`,
            lowestHeartRate: sql`excluded.lowest_heart_rate`,
            averageHrv: sql`excluded.average_hrv`,
            temperatureDelta: sql`excluded.temperature_delta`,
          },
        });
    }
    totalRecords += sleepData.length;

    for (const d of dailySleepData) {
      await db
        .insert(dailySleep)
        .values({
          id: d.id,
          day: d.day,
          score: d.score,
          contributorDeepSleep: d.contributors?.deep_sleep ?? null,
          contributorEfficiency: d.contributors?.efficiency ?? null,
          contributorLatency: d.contributors?.latency ?? null,
          contributorRemSleep: d.contributors?.rem_sleep ?? null,
          contributorRestfulness: d.contributors?.restfulness ?? null,
          contributorTiming: d.contributors?.timing ?? null,
          contributorTotalSleep: d.contributors?.total_sleep ?? null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: dailySleep.id,
          set: {
            score: sql`excluded.score`,
            contributorDeepSleep: sql`excluded.contributor_deep_sleep`,
            contributorEfficiency: sql`excluded.contributor_efficiency`,
            contributorLatency: sql`excluded.contributor_latency`,
            contributorRemSleep: sql`excluded.contributor_rem_sleep`,
            contributorRestfulness: sql`excluded.contributor_restfulness`,
            contributorTiming: sql`excluded.contributor_timing`,
            contributorTotalSleep: sql`excluded.contributor_total_sleep`,
          },
        });
    }
    totalRecords += dailySleepData.length;

    for (const r of readinessData) {
      await db
        .insert(dailyReadiness)
        .values({
          id: r.id,
          day: r.day,
          score: r.score,
          temperatureDeviation: r.temperature_deviation,
          temperatureTrendDeviation: r.temperature_trend_deviation,
          contributorActivityBalance: r.contributors?.activity_balance ?? null,
          contributorBodyTemperature: r.contributors?.body_temperature ?? null,
          contributorHrvBalance: r.contributors?.hrv_balance ?? null,
          contributorPreviousDayActivity:
            r.contributors?.previous_day_activity ?? null,
          contributorPreviousNight: r.contributors?.previous_night ?? null,
          contributorRecoveryIndex: r.contributors?.recovery_index ?? null,
          contributorRestingHeartRate:
            r.contributors?.resting_heart_rate ?? null,
          contributorSleepBalance: r.contributors?.sleep_balance ?? null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: dailyReadiness.id,
          set: {
            score: sql`excluded.score`,
            temperatureDeviation: sql`excluded.temperature_deviation`,
            temperatureTrendDeviation: sql`excluded.temperature_trend_deviation`,
          },
        });
    }
    totalRecords += readinessData.length;

    await db.insert(syncLog).values({
      syncType,
      startDate,
      endDate,
      recordsFetched: totalRecords,
      status: "success",
      createdAt: now,
    });

    return { success: true, records: totalRecords };
  } catch (error) {
    await db.insert(syncLog).values({
      syncType,
      startDate,
      endDate,
      recordsFetched: 0,
      status: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
      createdAt: now,
    });
    throw error;
  }
}
