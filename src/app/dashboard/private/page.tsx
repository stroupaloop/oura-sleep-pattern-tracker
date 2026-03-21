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
  sleepPeriods,
  dailyReadiness,
  healthSignals,
  dailyAnalysis,
  dailyMood,
} from "@/lib/db/schema";
import { desc, gte, eq, and } from "drizzle-orm";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";
import { PrivateTabs } from "./private-tabs";

export default async function PrivatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isSensitiveUser(session.user.email)) redirect("/dashboard");

  const cutoff = format(subDays(new Date(getTodayET() + "T12:00:00"), 90), "yyyy-MM-dd");

  const [
    cvAgeData,
    vo2Data,
    sleepTimeData,
    personalInfoData,
    cycleData,
    sleepData,
    readinessTempData,
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
      .select()
      .from(dailyHeartrate)
      .where(gte(dailyHeartrate.day, cutoff))
      .orderBy(dailyHeartrate.day)
      .catch(() => [] as { id: number; day: string; avgBpm: number | null; minBpm: number | null; maxBpm: number | null; restingBpm: number | null; awakeBpm: number | null; sampleCount: number | null; createdAt: number }[]),
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
      .where(gte(hourlyHeartrate.day, format(subDays(new Date(getTodayET() + "T12:00:00"), 14), "yyyy-MM-dd")))
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
    .where(gte(dailyActivity.day, format(subDays(new Date(getTodayET() + "T12:00:00"), 14), "yyyy-MM-dd")))
    .orderBy(dailyActivity.day)
    .catch(() => [] as { day: string; class5min: string | null; nonWearTime: number | null; highActivityTime: number | null; mediumActivityTime: number | null; lowActivityTime: number | null; sedentaryTime: number | null; restingTime: number | null }[]);

  const [cyclePhaseAnalysis, cyclePhaseMoods] = await Promise.all([
    db
      .select({
        day: dailyAnalysis.day,
        totalSleepMinutes: dailyAnalysis.totalSleepMinutes,
        efficiency: dailyAnalysis.efficiency,
        avgHrv: dailyAnalysis.avgHrv,
        temperatureDelta: dailyAnalysis.temperatureDelta,
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
  const cyclePhaseDaily = cyclePhaseAnalysis.map((a) => ({
    day: a.day,
    sleepHours: a.totalSleepMinutes ? a.totalSleepMinutes / 60 : null,
    efficiency: a.efficiency,
    avgHrv: a.avgHrv,
    moodScore: moodByDay.get(a.day) ?? null,
    temperatureDelta: a.temperatureDelta,
  }));

  const healthSignalData = await db
    .select({
      day: healthSignals.day,
      signalType: healthSignals.signalType,
      status: healthSignals.status,
      confidence: healthSignals.confidence,
      indicators: healthSignals.indicators,
      summary: healthSignals.summary,
    })
    .from(healthSignals)
    .where(gte(healthSignals.day, format(subDays(new Date(getTodayET() + "T12:00:00"), 30), "yyyy-MM-dd")))
    .orderBy(desc(healthSignals.day))
    .catch(() => [] as { day: string; signalType: string; status: string; confidence: number; indicators: string | null; summary: string | null }[]);

  const person = personalInfoData[0] ?? null;

  function normalizeOffsetMinutes(offsetSeconds: string | null | undefined): number | null {
    if (!offsetSeconds) return null;
    let mins = Number(offsetSeconds) / 60;
    if (mins < 0) mins += 1440;
    if (mins < 720) mins += 1440;
    return mins;
  }

  const bedtimeData = sleepData.map((t) => {
    const st = sleepTimeData.find((s) => s.day === t.day);
    let actualMinutes: number | null = null;
    if (t.bedtimeStart) {
      const d = new Date(t.bedtimeStart);
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(d);
      const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
      const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
      let mins = h * 60 + m;
      if (mins < 720) mins += 1440;
      actualMinutes = mins;
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
        cvAgeData={cvAgeData.map((c) => ({ day: c.day, vascularAge: c.vascularAge }))}
        vo2Data={vo2Data.map((v) => ({ day: v.day, vo2Max: v.vo2Max }))}
        personalInfo={person ? { age: person.age, height: person.height, weight: person.weight, biologicalSex: person.biologicalSex } : null}
        cycleData={cycleData.map((c) => ({ cycleNumber: c.cycleNumber, periodStartDay: c.periodStartDay, ovulationDay: c.ovulationDay, nextPeriodDay: c.nextPeriodDay, cycleLength: c.cycleLength, confidence: c.confidence }))}
        temperatureData={readinessTempData.map((t) => ({ day: t.day, temperatureDelta: t.temperatureDeviation }))}
        bedtimeData={bedtimeData}
        hrData={hrData.map((h) => ({ day: h.day, restingBpm: h.restingBpm, awakeBpm: h.awakeBpm, minBpm: h.minBpm, maxBpm: h.maxBpm }))}
        hourlyHrData={hourlyHrData}
        healthSignals={healthSignalData.map((s) => ({
          day: s.day,
          signalType: s.signalType,
          status: s.status,
          confidence: s.confidence,
          indicators: s.indicators ? JSON.parse(s.indicators) : [],
          summary: s.summary ?? "",
        }))}
        cyclePhaseDaily={cyclePhaseDaily}
        wearActivityData={wearActivityData.map((d) => ({
          day: d.day,
          class5min: d.class5min,
          nonWearTime: d.nonWearTime,
          highActivityTime: d.highActivityTime,
          mediumActivityTime: d.mediumActivityTime,
          lowActivityTime: d.lowActivityTime,
          sedentaryTime: d.sedentaryTime,
          restingTime: d.restingTime,
        }))}
        wearActivityHrData={hourlyHrData}
      />
    </div>
  );
}
