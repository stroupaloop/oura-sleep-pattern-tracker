export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth, isSensitiveUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  dailyCardiovascularAge,
  dailyHeartrate,
  hourlyHeartrate,
  dailyActivity,
  vo2Max,
  sleepTime,
  personalInfo,
  cyclePredictions,
  restModePeriods,
  sleepPeriods,
  dailyReadiness,
  healthSignals,
  dailyAnalysis,
  dailyMood,
  syncLog,
} from "@/lib/db/schema";
import { desc, gte, eq, and, isNotNull, ne, sql } from "drizzle-orm";
import { format, parseISO, subDays } from "date-fns";
import {
  APP_TIME_ZONE,
  getIsoTimeZoneClockMinutes,
  getTodayET,
  shiftIsoDay,
} from "@/lib/date-utils";
import {
  buildRestModeDaySet,
  longestConsecutiveTemperatureRun,
} from "@/lib/analysis/cycle";
import { projectActivityToCalendarDays } from "@/lib/oura/activity";
import { getOuraSleepDayForTimestamp } from "@/lib/oura/sleep-day";
import { getSleepTimeClockMinutes } from "@/lib/oura/sleep-time";
import {
  projectLatestSyncAttempts,
  resolveDatasetFreshness,
} from "@/lib/oura/freshness";
import { PrivateTabs } from "./private-tabs";

function parseIndicators(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      Array.isArray(parsed) &&
      parsed.every((indicator) => typeof indicator === "string")
    ) {
      return parsed;
    }
  } catch {
    return [];
  }
  return [];
}

export default async function PrivatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isSensitiveUser(session.user.email)) redirect("/dashboard");

  const currentDay = getTodayET();
  const today = parseISO(currentDay);
  const cutoff = format(subDays(today, 89), "yyyy-MM-dd");
  const fourteenDayCutoff = format(subDays(today, 13), "yyyy-MM-dd");
  const activitySourceCutoff =
    shiftIsoDay(fourteenDayCutoff, -1) ?? fourteenDayCutoff;
  const thirtyDayCutoff = format(subDays(today, 29), "yyyy-MM-dd");
  const sourceDaysPromise = Promise.all([
    db
      .select({ bedtimeEnd: sleepPeriods.bedtimeEnd })
      .from(sleepPeriods)
      .where(eq(sleepPeriods.type, "long_sleep"))
      .orderBy(desc(sleepPeriods.day), desc(sleepPeriods.bedtimeEnd))
      .limit(1)
      .then((rows) =>
        rows[0]?.bedtimeEnd
          ? getOuraSleepDayForTimestamp(rows[0].bedtimeEnd)
          : null
      ),
    db
      .select({
        day: sql<string | null>`max(${dailyCardiovascularAge.day})`,
      })
      .from(dailyCardiovascularAge)
      .where(isNotNull(dailyCardiovascularAge.vascularAge))
      .then((rows) => rows[0]?.day ?? null),
    db
      .select({ day: sql<string | null>`max(${vo2Max.day})` })
      .from(vo2Max)
      .where(isNotNull(vo2Max.vo2Max))
      .then((rows) => rows[0]?.day ?? null),
    db
      .select({ day: sql<string | null>`max(${sleepTime.day})` })
      .from(sleepTime)
      .then((rows) => rows[0]?.day ?? null),
  ]);

  const [
    cvAgeData,
    vo2Data,
    sleepTimeData,
    personalInfoData,
    cycleData,
    sleepData,
    readinessTempData,
    restModeData,
    hrData,
    hourlyHrData,
    recentSyncRows,
    sourceDays,
  ] = await Promise.all([
    db
      .select()
      .from(dailyCardiovascularAge)
      .where(gte(dailyCardiovascularAge.day, cutoff))
      .orderBy(dailyCardiovascularAge.day),
    db
      .select()
      .from(vo2Max)
      .where(gte(vo2Max.day, cutoff))
      .orderBy(vo2Max.day),
    db
      .select()
      .from(sleepTime)
      .where(gte(sleepTime.day, cutoff))
      .orderBy(sleepTime.day),
    db.select().from(personalInfo).limit(1),
    db
      .select()
      .from(cyclePredictions)
      .orderBy(desc(cyclePredictions.cycleNumber))
      .limit(12),
    db
      .select({
        day: sleepPeriods.day,
        bedtimeStart: sleepPeriods.bedtimeStart,
        bedtimeEnd: sleepPeriods.bedtimeEnd,
      })
      .from(sleepPeriods)
      .where(and(gte(sleepPeriods.day, cutoff), eq(sleepPeriods.type, "long_sleep")))
      .orderBy(sleepPeriods.day),
    db
      .select({
        day: dailyReadiness.day,
        temperatureDeviation: dailyReadiness.temperatureDeviation,
      })
      .from(dailyReadiness)
      .where(gte(dailyReadiness.day, cutoff))
      .orderBy(dailyReadiness.day),
    db
      .select({
        startDay: restModePeriods.startDay,
        endDay: restModePeriods.endDay,
      })
      .from(restModePeriods),
    db
      .select()
      .from(dailyHeartrate)
      .where(gte(dailyHeartrate.day, cutoff))
      .orderBy(dailyHeartrate.day),
    db
      .select({
        day: hourlyHeartrate.day,
        hour: hourlyHeartrate.hour,
        avgBpm: hourlyHeartrate.avgBpm,
        minBpm: hourlyHeartrate.minBpm,
        maxBpm: hourlyHeartrate.maxBpm,
        source: hourlyHeartrate.source,
      })
      .from(hourlyHeartrate)
      .where(gte(hourlyHeartrate.day, fourteenDayCutoff))
      .orderBy(hourlyHeartrate.day, hourlyHeartrate.hour),
    db
      .select({
        syncType: syncLog.syncType,
        status: syncLog.status,
        errorMessage: syncLog.errorMessage,
        createdAt: syncLog.createdAt,
      })
      .from(syncLog)
      .where(ne(syncLog.syncType, "cron-hr"))
      .orderBy(desc(syncLog.createdAt))
      .limit(100),
    sourceDaysPromise,
  ]);

  const wearActivityData = await db
    .select({
      day: dailyActivity.day,
      class5min: dailyActivity.class5min,
      met: dailyActivity.met,
    })
    .from(dailyActivity)
    .where(gte(dailyActivity.day, activitySourceCutoff))
    .orderBy(dailyActivity.day);
  const projectedWearActivityData = projectActivityToCalendarDays(
    wearActivityData,
    APP_TIME_ZONE
  ).filter(
    (activityDay) =>
      activityDay.day >= fourteenDayCutoff && activityDay.day <= currentDay
  );

  const [cyclePhaseAnalysis, cyclePhaseMoods] = await Promise.all([
    db
      .select({
        day: dailyAnalysis.day,
        totalSleepMinutes: dailyAnalysis.totalSleepMinutes,
        efficiency: dailyAnalysis.efficiency,
        avgHrv: dailyAnalysis.avgHrv,
      })
      .from(dailyAnalysis)
      .where(gte(dailyAnalysis.day, cutoff))
      .orderBy(dailyAnalysis.day),
    db
      .select({
        day: dailyMood.day,
        moodScore: dailyMood.moodScore,
      })
      .from(dailyMood)
      .where(gte(dailyMood.day, cutoff))
      .orderBy(dailyMood.day),
  ]);

  const moodByDay = new Map(cyclePhaseMoods.map((m) => [m.day, m.moodScore]));
  const readinessTemperatureByDay = new Map(
    readinessTempData.map((r) => [r.day, r.temperatureDeviation])
  );
  const restModeDays = buildRestModeDaySet(
    restModeData,
    cutoff,
    currentDay
  );
  const eligibleTemperatureRun = longestConsecutiveTemperatureRun(
    readinessTempData
      .filter(
        (
          row
        ): row is { day: string; temperatureDeviation: number } =>
          row.temperatureDeviation != null
      )
      .map((row) => ({
        day: row.day,
        temperatureDelta: row.temperatureDeviation,
      })),
    restModeDays
  );
  const cyclePhaseDaily = cyclePhaseAnalysis.map((a) => ({
    day: a.day,
    sleepHours:
      a.totalSleepMinutes != null ? a.totalSleepMinutes / 60 : null,
    efficiency: a.efficiency,
    avgHrv: a.avgHrv,
    moodScore: moodByDay.get(a.day) ?? null,
    temperatureDelta: readinessTemperatureByDay.get(a.day) ?? null,
  }));

  const healthSignalData = await db
    .select({
      day: healthSignals.day,
      signalType: healthSignals.signalType,
      status: healthSignals.status,
      confidence: healthSignals.confidence,
      indicators: healthSignals.indicators,
    })
    .from(healthSignals)
    .where(gte(healthSignals.day, thirtyDayCutoff))
    .orderBy(desc(healthSignals.day));

  const person = personalInfoData[0] ?? null;

  function normalizeOffsetMinutes(
    storedOffset: string | null | undefined,
    day: string
  ): number | null {
    let mins = getSleepTimeClockMinutes(day, storedOffset);
    if (mins == null) return null;
    if (mins < 720) mins += 1440;
    return mins;
  }

  const bedtimeData = sleepData.flatMap((t) => {
    const sleepDayET = getOuraSleepDayForTimestamp(t.bedtimeEnd);
    if (sleepDayET == null) return [];

    const st = sleepTimeData.find((s) => s.day === t.day);
    let actualMinutes: number | null = null;
    if (t.bedtimeStart) {
      const etClockMinutes = getIsoTimeZoneClockMinutes(t.bedtimeStart);
      if (etClockMinutes != null) {
        actualMinutes =
          etClockMinutes < 720
            ? etClockMinutes + 1440
            : etClockMinutes;
      }
    }
    return [
      {
        day: sleepDayET,
        actualBedtime: actualMinutes,
        optimalStart: normalizeOffsetMinutes(st?.optimalBedtimeStart, t.day),
        optimalEnd: normalizeOffsetMinutes(st?.optimalBedtimeEnd, t.day),
      },
    ];
  });
  const [
    latestSleepSourceDay,
    latestCardiovascularAgeSourceDay,
    latestVo2MaxSourceDay,
    latestBedtimeGuidanceSourceDay,
  ] = sourceDays;
  const syncAttempts = projectLatestSyncAttempts(recentSyncRows);
  const sourceFreshness = {
    sleep: resolveDatasetFreshness(
      syncAttempts.core,
      "sleep",
      latestSleepSourceDay
    ),
    cardiovascularAge: resolveDatasetFreshness(
      syncAttempts.private,
      "daily_cardiovascular_age",
      latestCardiovascularAgeSourceDay
    ),
    vo2Max: resolveDatasetFreshness(
      syncAttempts.private,
      "vO2_max",
      latestVo2MaxSourceDay
    ),
    bedtimeGuidance: resolveDatasetFreshness(
      syncAttempts.private,
      "sleep_time",
      latestBedtimeGuidanceSourceDay
    ),
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Private Data</h1>
      <PrivateTabs
        currentDay={currentDay}
        cvAgeData={cvAgeData.map((c) => ({ day: c.day, vascularAge: c.vascularAge }))}
        vo2Data={vo2Data.map((v) => ({ day: v.day, vo2Max: v.vo2Max }))}
        personalInfo={person ? { age: person.age, height: person.height, weight: person.weight, biologicalSex: person.biologicalSex } : null}
        cycleData={cycleData.map((c) => ({ cycleNumber: c.cycleNumber, periodStartDay: c.periodStartDay, thermalShiftDay: c.thermalShiftDay, nextPeriodDay: c.nextPeriodDay, interShiftDays: c.interShiftDays, evidenceScore: c.confidence }))}
        temperatureData={readinessTempData.map((t) => ({ day: t.day, temperatureDelta: t.temperatureDeviation }))}
        eligibleTemperatureRun={eligibleTemperatureRun}
        bedtimeData={bedtimeData}
        hrData={hrData.map((h) => ({ day: h.day, restingBpm: h.restingBpm, awakeBpm: h.awakeBpm, minBpm: h.minBpm, maxBpm: h.maxBpm }))}
        hourlyHrData={hourlyHrData}
        healthSignals={healthSignalData.map((s) => ({
          day: s.day,
          signalType: s.signalType,
          status: s.status,
          evidenceScore: s.confidence,
          indicators: parseIndicators(s.indicators),
        }))}
        cyclePhaseDaily={cyclePhaseDaily}
        wearActivityData={projectedWearActivityData}
        wearActivityHrData={hourlyHrData}
        sourceFreshness={sourceFreshness}
      />
    </div>
  );
}
