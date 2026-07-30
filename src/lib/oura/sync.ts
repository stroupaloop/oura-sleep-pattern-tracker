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
  enhancedTags,
  restModePeriods,
  dailyCardiovascularAge,
  dailyHeartrate,
  hourlyHeartrate,
  vo2Max,
  sleepTime,
  personalInfo,
} from "@/lib/db/schema";
import { ouraFetch, ouraFetchSingle } from "./client";
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
  OuraEnhancedTag,
  OuraRestModePeriod,
  OuraDailyCardiovascularAge,
  OuraVo2Max,
  OuraSleepTime,
  OuraPersonalInfo,
  OuraHeartrateSample,
} from "./types";
import { sql } from "drizzle-orm";
import {
  OURA_ENDPOINTS,
  averageOuraTimeSeries,
  fetchOptionalOuraCollection,
  formatOuraSyncWarnings,
  getAppAlignedHypnogram,
  getEnhancedTagDay,
  minimumOuraTimeSeries,
  runOptionalOuraTask,
  type OuraSyncWarning,
} from "./contracts";
import {
  aggregateHeartRateSamples,
  getHeartRateQueryRange,
} from "./heartrate";

export async function syncDateRange(
  startDate: string,
  endDate: string,
  syncType: string
) {
  const now = Math.floor(Date.now() / 1000);
  let totalRecords = 0;
  const warnings: OuraSyncWarning[] = [];

  try {
    const params = { start_date: startDate, end_date: endDate };

    const [sleepData, dailySleepData, readinessData] = await Promise.all([
      ouraFetch<OuraSleepPeriod>("v2/usercollection/sleep", params),
      ouraFetch<OuraDailySleep>("v2/usercollection/daily_sleep", params),
      ouraFetch<OuraDailyReadiness>("v2/usercollection/daily_readiness", params),
    ]);

    const [activityData, stressData] = await Promise.all([
      ouraFetch<OuraDailyActivity>("v2/usercollection/daily_activity", params),
      ouraFetch<OuraDailyStress>("v2/usercollection/daily_stress", params),
    ]);

    const resilienceResult = await fetchOptionalOuraCollection(
      "daily_resilience",
      () =>
        ouraFetch<OuraDailyResilience>(
          "v2/usercollection/daily_resilience",
          params,
          { refreshUnauthorized: false }
        )
    );
    const resilienceData = resilienceResult.data;
    if (resilienceResult.warning) warnings.push(resilienceResult.warning);

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
          averageHeartRate:
            averageOuraTimeSeries(s.heart_rate) ?? s.average_heart_rate,
          lowestHeartRate:
            minimumOuraTimeSeries(s.heart_rate) ?? s.lowest_heart_rate,
          averageHrv: s.average_hrv,
          temperatureDelta: null,
          averageBreath: s.average_breath,
          restlessPeriods: s.restless_periods,
          timeInBed: s.time_in_bed,
          hr5min: s.heart_rate ? JSON.stringify(s.heart_rate) : null,
          hrv5min: s.hrv?.items ? JSON.stringify(s.hrv.items) : null,
          hypnogram5min: getAppAlignedHypnogram(s),
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: sleepPeriods.id,
          set: {
            day: sql`excluded.day`,
            type: sql`excluded.type`,
            bedtimeStart: sql`excluded.bedtime_start`,
            bedtimeEnd: sql`excluded.bedtime_end`,
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
            day: sql`excluded.day`,
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
            day: sql`excluded.day`,
            score: sql`excluded.score`,
            temperatureDeviation: sql`excluded.temperature_deviation`,
            temperatureTrendDeviation: sql`excluded.temperature_trend_deviation`,
            contributorActivityBalance:
              sql`excluded.contributor_activity_balance`,
            contributorBodyTemperature:
              sql`excluded.contributor_body_temperature`,
            contributorHrvBalance: sql`excluded.contributor_hrv_balance`,
            contributorPreviousDayActivity:
              sql`excluded.contributor_previous_day_activity`,
            contributorPreviousNight:
              sql`excluded.contributor_previous_night`,
            contributorRecoveryIndex:
              sql`excluded.contributor_recovery_index`,
            contributorRestingHeartRate:
              sql`excluded.contributor_resting_heart_rate`,
            contributorSleepBalance:
              sql`excluded.contributor_sleep_balance`,
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
          class5min: a.class_5_min,
          met: a.met ? JSON.stringify(a.met) : null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: dailyActivity.id,
          set: {
            day: sql`excluded.day`,
            score: sql`excluded.score`,
            activeCalories: sql`excluded.active_calories`,
            totalCalories: sql`excluded.total_calories`,
            steps: sql`excluded.steps`,
            highActivityTime: sql`excluded.high_activity_time`,
            mediumActivityTime: sql`excluded.medium_activity_time`,
            lowActivityTime: sql`excluded.low_activity_time`,
            sedentaryTime: sql`excluded.sedentary_time`,
            restingTime: sql`excluded.resting_time`,
            nonWearTime: sql`excluded.non_wear_time`,
            averageMetMinutes: sql`excluded.average_met_minutes`,
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
            day: sql`excluded.day`,
            stressHigh: sql`excluded.stress_high`,
            recoveryHigh: sql`excluded.recovery_high`,
            daySummary: sql`excluded.day_summary`,
          },
        });
    }
    totalRecords += stressData.length;

    if (!resilienceResult.warning) {
      for (const r of resilienceData) {
        await db
          .insert(dailyResilience)
          .values({
            id: r.id,
            day: r.day,
            level: r.level,
            contributorSleepRecovery: r.contributors?.sleep_recovery ?? null,
            contributorDaytimeRecovery:
              r.contributors?.daytime_recovery ?? null,
            contributorStress: r.contributors?.stress ?? null,
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: dailyResilience.id,
            set: {
              day: sql`excluded.day`,
              level: sql`excluded.level`,
              contributorSleepRecovery:
                sql`excluded.contributor_sleep_recovery`,
              contributorDaytimeRecovery:
                sql`excluded.contributor_daytime_recovery`,
              contributorStress: sql`excluded.contributor_stress`,
            },
          });
      }
      totalRecords += resilienceData.length;
    }

    const [spo2Result, workoutResult, sessionResult] = await Promise.all([
      fetchOptionalOuraCollection("daily_spo2", () =>
        ouraFetch<OuraDailySpO2>("v2/usercollection/daily_spo2", params)
      ),
      fetchOptionalOuraCollection("workout", () =>
        ouraFetch<OuraWorkout>("v2/usercollection/workout", params)
      ),
      fetchOptionalOuraCollection("session", () =>
        ouraFetch<OuraSession>("v2/usercollection/session", params)
      ),
    ]);
    const spo2Data = spo2Result.data;
    const workoutData = workoutResult.data;
    const sessionData = sessionResult.data;
    warnings.push(
      ...[spo2Result, workoutResult, sessionResult].flatMap((result) =>
        result.warning ? [result.warning] : []
      )
    );

    if (!spo2Result.warning) {
      const writeResult = await runOptionalOuraTask(
        "daily_spo2",
        async () => {
          for (const s of spo2Data) {
            const avg = s.spo2_percentage?.average ?? null;
            const bdi = s.breathing_disturbance_index ?? null;
            await db
              .insert(dailySpo2)
              .values({
                id: s.id,
                day: s.day,
                averageSpo2: avg,
                breathingDisturbanceIndex: bdi,
                createdAt: now,
              })
              .onConflictDoUpdate({
                target: dailySpo2.id,
                set: {
                  day: sql`excluded.day`,
                  averageSpo2: sql`excluded.average_spo2`,
                  breathingDisturbanceIndex:
                    sql`excluded.breathing_disturbance_index`,
                },
              });
          }
          return spo2Data.length;
        }
      );
      if (writeResult.warning) warnings.push(writeResult.warning);
      else totalRecords += writeResult.value ?? 0;
    }

    if (!workoutResult.warning) {
      const writeResult = await runOptionalOuraTask("workout", async () => {
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
                day: sql`excluded.day`,
                activity: sql`excluded.activity`,
                calories: sql`excluded.calories`,
                distance: sql`excluded.distance`,
                intensity: sql`excluded.intensity`,
                startDatetime: sql`excluded.start_datetime`,
                endDatetime: sql`excluded.end_datetime`,
              },
            });
        }
        return workoutData.length;
      });
      if (writeResult.warning) warnings.push(writeResult.warning);
      else totalRecords += writeResult.value ?? 0;
    }

    if (!sessionResult.warning) {
      const writeResult = await runOptionalOuraTask("session", async () => {
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
              avgHr: averageOuraTimeSeries(s.heart_rate),
              avgHrv: averageOuraTimeSeries(s.heart_rate_variability),
              createdAt: now,
            })
            .onConflictDoUpdate({
              target: sessionsOura.id,
              set: {
                day: sql`excluded.day`,
                type: sql`excluded.type`,
                mood: sql`excluded.mood`,
                startDatetime: sql`excluded.start_datetime`,
                endDatetime: sql`excluded.end_datetime`,
                avgHr: sql`excluded.avg_hr`,
                avgHrv: sql`excluded.avg_hrv`,
              },
            });
        }
        return sessionData.length;
      });
      if (writeResult.warning) warnings.push(writeResult.warning);
      else totalRecords += writeResult.value ?? 0;
    }

    const heartRateRange = getHeartRateQueryRange(startDate, endDate);
    const heartrateResult = await fetchOptionalOuraCollection("heartrate", () =>
      ouraFetch<OuraHeartrateSample>("v2/usercollection/heartrate", {
        start_datetime: heartRateRange.startDatetime,
        end_datetime: heartRateRange.endDatetime,
      })
    );
    const hrSamples = heartrateResult.data;
    if (heartrateResult.warning) warnings.push(heartrateResult.warning);

    if (!heartrateResult.warning) {
      const writeResult = await runOptionalOuraTask("heartrate", async () => {
        if (hrSamples.length === 0) return 0;
        const buckets = aggregateHeartRateSamples(hrSamples);

        for (const bucket of buckets.daily) {
          await db
            .insert(dailyHeartrate)
            .values({ ...bucket, createdAt: now })
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

        for (const bucket of buckets.hourly) {
          await db
            .insert(hourlyHeartrate)
            .values({ ...bucket, createdAt: now })
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
        return buckets.daily.length;
      });
      if (writeResult.warning) warnings.push(writeResult.warning);
      else totalRecords += writeResult.value ?? 0;
    }

    const status = warnings.length > 0 ? "partial" : "success";
    await db.insert(syncLog).values({
      syncType,
      startDate,
      endDate,
      recordsFetched: totalRecords,
      status,
      errorMessage: formatOuraSyncWarnings(warnings),
      createdAt: now,
    });

    return {
      success: true,
      status,
      records: totalRecords,
      warnings,
    };
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

export async function syncSensitiveDateRange(
  startDate: string,
  endDate: string,
  syncType: string
) {
  const now = Math.floor(Date.now() / 1000);
  let totalRecords = 0;
  const warnings: OuraSyncWarning[] = [];

  try {
    const params = { start_date: startDate, end_date: endDate };

    const [restModeData, personalInfoData] = await Promise.all([
      ouraFetch<OuraRestModePeriod>(
        "v2/usercollection/rest_mode_period",
        params
      ),
      ouraFetchSingle<OuraPersonalInfo>("v2/usercollection/personal_info"),
    ]);

    const [tagResult, cvAgeResult, vo2Result, sleepTimeResult] =
      await Promise.all([
        fetchOptionalOuraCollection("enhanced_tag", async () => {
          const tags = await ouraFetch<OuraEnhancedTag>(
            "v2/usercollection/enhanced_tag",
            params,
            { refreshUnauthorized: false }
          );
          tags.forEach(getEnhancedTagDay);
          return tags;
        }),
        fetchOptionalOuraCollection("daily_cardiovascular_age", () =>
          ouraFetch<OuraDailyCardiovascularAge>(
            "v2/usercollection/daily_cardiovascular_age",
            params,
            { refreshUnauthorized: false }
          )
        ),
        fetchOptionalOuraCollection("vO2_max", () =>
          ouraFetch<OuraVo2Max>(OURA_ENDPOINTS.vo2Max, params, {
            refreshUnauthorized: false,
          })
        ),
        fetchOptionalOuraCollection("sleep_time", () =>
          ouraFetch<OuraSleepTime>(OURA_ENDPOINTS.sleepTime, params, {
            refreshUnauthorized: false,
          })
        ),
      ]);
    const tagData = tagResult.data;
    const cvAgeData = cvAgeResult.data;
    const vo2Data = vo2Result.data;
    const sleepTimeData = sleepTimeResult.data;
    warnings.push(
      ...[tagResult, cvAgeResult, vo2Result, sleepTimeResult].flatMap(
        (result) => (result.warning ? [result.warning] : [])
      )
    );

    if (!tagResult.warning) {
      const writeResult = await runOptionalOuraTask(
        "enhanced_tag",
        async () => {
          for (const t of tagData) {
            await db
              .insert(enhancedTags)
              .values({
                id: t.id,
                day: getEnhancedTagDay(t),
                tagTypeCode: t.tag_type_code,
                startTime: t.start_time,
                endTime: t.end_time,
                comment: t.comment,
                createdAt: now,
              })
              .onConflictDoUpdate({
                target: enhancedTags.id,
                set: {
                  day: sql`excluded.day`,
                  tagTypeCode: sql`excluded.tag_type_code`,
                  startTime: sql`excluded.start_time`,
                  endTime: sql`excluded.end_time`,
                  comment: sql`excluded.comment`,
                },
              });
          }
          return tagData.length;
        }
      );
      if (writeResult.warning) warnings.push(writeResult.warning);
      else totalRecords += writeResult.value ?? 0;
    }

    for (const r of restModeData) {
      await db
        .insert(restModePeriods)
        .values({
          id: r.id,
          startDay: r.start_day,
          endDay: r.end_day,
          startTime: r.start_time,
          endTime: r.end_time,
          episodes: r.episodes ? JSON.stringify(r.episodes) : null,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: restModePeriods.id,
          set: {
            startDay: sql`excluded.start_day`,
            endDay: sql`excluded.end_day`,
            startTime: sql`excluded.start_time`,
            endTime: sql`excluded.end_time`,
            episodes: sql`excluded.episodes`,
          },
        });
    }
    totalRecords += restModeData.length;

    if (!cvAgeResult.warning) {
      const writeResult = await runOptionalOuraTask(
        "daily_cardiovascular_age",
        async () => {
          for (const c of cvAgeData) {
            await db
              .insert(dailyCardiovascularAge)
              .values({
                day: c.day,
                vascularAge: c.vascular_age,
                createdAt: now,
              })
              .onConflictDoUpdate({
                target: dailyCardiovascularAge.day,
                set: {
                  vascularAge: sql`excluded.vascular_age`,
                },
              });
          }
          return cvAgeData.length;
        }
      );
      if (writeResult.warning) warnings.push(writeResult.warning);
      else totalRecords += writeResult.value ?? 0;
    }

    if (!vo2Result.warning) {
      const writeResult = await runOptionalOuraTask("vO2_max", async () => {
        for (const v of vo2Data) {
          await db
            .insert(vo2Max)
            .values({
              id: v.id,
              day: v.day,
              vo2Max: v.vo2_max,
              createdAt: now,
            })
            .onConflictDoUpdate({
              target: vo2Max.id,
              set: {
                day: sql`excluded.day`,
                vo2Max: sql`excluded.vo2_max`,
              },
            });
        }
        return vo2Data.length;
      });
      if (writeResult.warning) warnings.push(writeResult.warning);
      else totalRecords += writeResult.value ?? 0;
    }

    if (!sleepTimeResult.warning) {
      const writeResult = await runOptionalOuraTask("sleep_time", async () => {
        for (const s of sleepTimeData) {
          const startOffset = s.optimal_bedtime?.start_offset;
          const endOffset = s.optimal_bedtime?.end_offset;
          await db
            .insert(sleepTime)
            .values({
              id: s.id,
              day: s.day,
              optimalBedtimeStart:
                startOffset != null ? String(startOffset) : null,
              optimalBedtimeEnd:
                endOffset != null ? String(endOffset) : null,
              recommendation: s.recommendation,
              status: s.status,
              createdAt: now,
            })
            .onConflictDoUpdate({
              target: sleepTime.id,
              set: {
                day: sql`excluded.day`,
                optimalBedtimeStart: sql`excluded.optimal_bedtime_start`,
                optimalBedtimeEnd: sql`excluded.optimal_bedtime_end`,
                recommendation: sql`excluded.recommendation`,
                status: sql`excluded.status`,
              },
            });
        }
        return sleepTimeData.length;
      });
      if (writeResult.warning) warnings.push(writeResult.warning);
      else totalRecords += writeResult.value ?? 0;
    }

    await db
      .insert(personalInfo)
      .values({
        id: personalInfoData.id,
        age: personalInfoData.age,
        weight: personalInfoData.weight,
        height: personalInfoData.height,
        biologicalSex: personalInfoData.biological_sex,
        email: personalInfoData.email,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: personalInfo.id,
        set: {
          age: sql`excluded.age`,
          weight: sql`excluded.weight`,
          height: sql`excluded.height`,
          biologicalSex: sql`excluded.biological_sex`,
          email: sql`excluded.email`,
        },
      });
    totalRecords += 1;

    const status = warnings.length > 0 ? "partial" : "success";
    await db.insert(syncLog).values({
      syncType: `${syncType}-sensitive`,
      startDate,
      endDate,
      recordsFetched: totalRecords,
      status,
      errorMessage: formatOuraSyncWarnings(warnings),
      createdAt: now,
    });

    return {
      success: true,
      status,
      records: totalRecords,
      warnings,
    };
  } catch (error) {
    await db.insert(syncLog).values({
      syncType: `${syncType}-sensitive`,
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
