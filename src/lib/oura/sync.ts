import { db } from "@/lib/db";
import {
  sleepPeriods,
  dailySleep,
  dailyReadiness,
  dailyActivity,
  dailyStress,
  dailyResilience,
  dailySpo2,
  workouts,
  sessionsOura,
  syncLog,
} from "@/lib/db/schema";
import { ouraFetch } from "./client";
import type {
  OuraSleepPeriod,
  OuraDailySleep,
  OuraDailyReadiness,
  OuraDailyActivity,
  OuraDailyStress,
  OuraDailyResilience,
  OuraDailySpO2,
  OuraWorkout,
  OuraSession,
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

    const [activityData, stressData, resilienceData] = await Promise.all([
      ouraFetch<OuraDailyActivity>("v2/usercollection/daily_activity", params).catch(() => [] as OuraDailyActivity[]),
      ouraFetch<OuraDailyStress>("v2/usercollection/daily_stress", params).catch(() => [] as OuraDailyStress[]),
      ouraFetch<OuraDailyResilience>("v2/usercollection/daily_resilience", params).catch(() => [] as OuraDailyResilience[]),
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
            averageBreath: sql`excluded.average_breath`,
            restlessPeriods: sql`excluded.restless_periods`,
            timeInBed: sql`excluded.time_in_bed`,
            hr5min: sql`excluded.hr_5min`,
            hrv5min: sql`excluded.hrv_5min`,
            hypnogram5min: sql`excluded.hypnogram_5min`,
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

    for (const a of activityData) {
      await db
        .insert(dailyActivity)
        .values({
          id: a.id,
          day: a.day,
          score: a.score,
          activeCalories: a.active_calories,
          totalCalories: a.total_calories,
          steps: a.steps,
          highActivityTime: a.high_activity_time,
          mediumActivityTime: a.medium_activity_time,
          lowActivityTime: a.low_activity_time,
          sedentaryTime: a.sedentary_time,
          restingTime: a.resting_time,
          nonWearTime: a.non_wear_time,
          averageMetMinutes: a.average_met_minutes,
          class5min: a.class_5min,
          met: a.met ? JSON.stringify(a.met) : null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: dailyActivity.id,
          set: {
            score: sql`excluded.score`,
            activeCalories: sql`excluded.active_calories`,
            totalCalories: sql`excluded.total_calories`,
            steps: sql`excluded.steps`,
            highActivityTime: sql`excluded.high_activity_time`,
            mediumActivityTime: sql`excluded.medium_activity_time`,
            lowActivityTime: sql`excluded.low_activity_time`,
            sedentaryTime: sql`excluded.sedentary_time`,
            class5min: sql`excluded.class_5min`,
            met: sql`excluded.met`,
          },
        });
    }
    totalRecords += activityData.length;

    for (const s of stressData) {
      await db
        .insert(dailyStress)
        .values({
          id: s.id,
          day: s.day,
          stressHigh: s.stress_high,
          recoveryHigh: s.recovery_high,
          daySummary: s.day_summary,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: dailyStress.id,
          set: {
            stressHigh: sql`excluded.stress_high`,
            recoveryHigh: sql`excluded.recovery_high`,
            daySummary: sql`excluded.day_summary`,
          },
        });
    }
    totalRecords += stressData.length;

    for (const r of resilienceData) {
      await db
        .insert(dailyResilience)
        .values({
          id: r.id,
          day: r.day,
          level: r.level,
          contributorSleepRecovery: r.contributors?.sleep_recovery ?? null,
          contributorDaytimeRecovery: r.contributors?.daytime_recovery ?? null,
          contributorStress: r.contributors?.stress ?? null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: dailyResilience.id,
          set: {
            level: sql`excluded.level`,
            contributorSleepRecovery: sql`excluded.contributor_sleep_recovery`,
            contributorDaytimeRecovery: sql`excluded.contributor_daytime_recovery`,
            contributorStress: sql`excluded.contributor_stress`,
          },
        });
    }
    totalRecords += resilienceData.length;

    const [spo2Data, workoutData, sessionData] = await Promise.all([
      ouraFetch<OuraDailySpO2>("v2/usercollection/daily_spo2", params).catch(() => [] as OuraDailySpO2[]),
      ouraFetch<OuraWorkout>("v2/usercollection/workout", params).catch(() => [] as OuraWorkout[]),
      ouraFetch<OuraSession>("v2/usercollection/session", params).catch(() => [] as OuraSession[]),
    ]);

    for (const s of spo2Data) {
      await db
        .insert(dailySpo2)
        .values({
          id: s.id,
          day: s.day,
          averageSpo2: s.spo2_percentage?.average ?? null,
          breathingDisturbanceIndex: s.breathing_disturbance_index,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: dailySpo2.id,
          set: {
            averageSpo2: sql`excluded.average_spo2`,
            breathingDisturbanceIndex: sql`excluded.breathing_disturbance_index`,
          },
        });
    }
    totalRecords += spo2Data.length;

    for (const w of workoutData) {
      await db
        .insert(workouts)
        .values({
          id: w.id,
          day: w.day,
          activity: w.activity,
          calories: w.calories,
          distance: w.distance,
          intensity: w.intensity,
          startDatetime: w.start_datetime,
          endDatetime: w.end_datetime,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: workouts.id,
          set: {
            activity: sql`excluded.activity`,
            calories: sql`excluded.calories`,
            distance: sql`excluded.distance`,
            intensity: sql`excluded.intensity`,
          },
        });
    }
    totalRecords += workoutData.length;

    for (const s of sessionData) {
      await db
        .insert(sessionsOura)
        .values({
          id: s.id,
          day: s.day,
          type: s.type,
          mood: s.mood,
          startDatetime: s.start_datetime,
          endDatetime: s.end_datetime,
          avgHr: s.heart_rate?.average ?? null,
          avgHrv: s.heart_rate_variability?.average ?? null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: sessionsOura.id,
          set: {
            type: sql`excluded.type`,
            mood: sql`excluded.mood`,
            avgHr: sql`excluded.avg_hr`,
            avgHrv: sql`excluded.avg_hrv`,
          },
        });
    }
    totalRecords += sessionData.length;

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
