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
} from "@/lib/db/schema";
import { desc, gte, eq, and } from "drizzle-orm";
import { format, parseISO, subDays } from "date-fns";
import {
  getIsoLocalClockMinutes,
  getTodayET,
  shiftIsoDay,
} from "@/lib/date-utils";
import { longestConsecutiveTemperatureRun } from "@/lib/analysis/cycle";
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
  const thirtyDayCutoff = format(subDays(today, 29), "yyyy-MM-dd");

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
  ]);

  const wearActivityData = await db
    .select({
      day: dailyActivity.day,
      class5min: dailyActivity.class5min,
      nonWearTime: dailyActivity.nonWearTime,
      highActivityTime: dailyActivity.highActivityTime,
      mediumActivityTime: dailyActivity.mediumActivityTime,
      lowActivityTime: dailyActivity.lowActivityTime,
      sedentaryTime: dailyActivity.sedentaryTime,
      restingTime: dailyActivity.restingTime,
    })
    .from(dailyActivity)
    .where(gte(dailyActivity.day, fourteenDayCutoff))
    .orderBy(dailyActivity.day);

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
  const restModeDays = new Set<string>();
  for (const period of restModeData) {
    if (!period.startDay || !period.endDay) continue;
    let day: string | null = period.startDay;
    let guard = 0;
    while (day != null && day <= period.endDay && guard < 400) {
      restModeDays.add(day);
      day = shiftIsoDay(day, 1);
      guard++;
    }
  }
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

  function normalizeOffsetMinutes(offsetSeconds: string | null | undefined): number | null {
    if (!offsetSeconds) return null;
    const seconds = Number(offsetSeconds);
    if (!Number.isFinite(seconds)) return null;
    let mins = Math.round(seconds / 60);
    mins = ((mins % 1440) + 1440) % 1440;
    if (mins < 720) mins += 1440;
    return mins;
  }

  const bedtimeData = sleepData.map((t) => {
    const st = sleepTimeData.find((s) => s.day === t.day);
    let actualMinutes: number | null = null;
    if (t.bedtimeStart) {
      const localClockMinutes = getIsoLocalClockMinutes(t.bedtimeStart);
      if (localClockMinutes != null) {
        actualMinutes =
          localClockMinutes < 720
            ? localClockMinutes + 1440
            : localClockMinutes;
      }
    }
    return {
      day: t.day,
      actualBedtime: actualMinutes,
      optimalStart: normalizeOffsetMinutes(st?.optimalBedtimeStart),
      optimalEnd: normalizeOffsetMinutes(st?.optimalBedtimeEnd),
    };
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Private Data</h1>
      <PrivateTabs
        currentDay={currentDay}
        cvAgeData={cvAgeData.map((c) => ({ day: c.day, vascularAge: c.vascularAge }))}
        vo2Data={vo2Data.map((v) => ({ day: v.day, vo2Max: v.vo2Max }))}
        personalInfo={person ? { age: person.age, height: person.height, weight: person.weight, biologicalSex: person.biologicalSex } : null}
        cycleData={cycleData.map((c) => ({ cycleNumber: c.cycleNumber, periodStartDay: c.periodStartDay, ovulationDay: c.ovulationDay, nextPeriodDay: c.nextPeriodDay, cycleLength: c.cycleLength, evidenceScore: c.confidence }))}
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
        wearActivityData={wearActivityData.map((d) => ({
          day: d.day,
          class5min: d.class5min,
          nonWearMinutes:
            d.nonWearTime != null ? Math.round(d.nonWearTime / 60) : null,
          highActivityMinutes:
            d.highActivityTime != null
              ? Math.round(d.highActivityTime / 60)
              : null,
          mediumActivityMinutes:
            d.mediumActivityTime != null
              ? Math.round(d.mediumActivityTime / 60)
              : null,
          lowActivityMinutes:
            d.lowActivityTime != null
              ? Math.round(d.lowActivityTime / 60)
              : null,
          sedentaryMinutes:
            d.sedentaryTime != null
              ? Math.round(d.sedentaryTime / 60)
              : null,
          restingMinutes:
            d.restingTime != null ? Math.round(d.restingTime / 60) : null,
        }))}
        wearActivityHrData={hourlyHrData}
      />
    </div>
  );
}
