import { db } from "@/lib/db";
import { sleepPeriods, dailyAnalysis } from "@/lib/db/schema";
import { desc, sql, and, lt, eq } from "drizzle-orm";
import {
  trimmedMean,
  standardDeviation,
  zScore,
  minutesFromMidnight,
} from "./baseline";

const MIN_BASELINE_DAYS = 14;

const WEIGHTS = {
  sleepDuration: 0.3,
  bedtime: 0.2,
  wakeTime: 0.15,
  hrv: 0.15,
  heartRate: 0.1,
  latency: 0.1,
};

interface DayMetrics {
  day: string;
  totalSleepMinutes: number;
  bedtimeMinutes: number;
  wakeTimeMinutes: number;
  avgHrv: number;
  avgHeartRate: number;
  onsetLatencyMinutes: number;
  remPct: number;
  deepPct: number;
  efficiency: number;
  temperatureDelta: number;
}

function extractMetrics(
  s: typeof sleepPeriods.$inferSelect
): DayMetrics | null {
  if (!s.totalSleepDuration) return null;
  const totalMin = s.totalSleepDuration / 60;
  return {
    day: s.day,
    totalSleepMinutes: totalMin,
    bedtimeMinutes: minutesFromMidnight(s.bedtimeStart),
    wakeTimeMinutes: minutesFromMidnight(s.bedtimeEnd),
    avgHrv: s.averageHrv ?? 0,
    avgHeartRate: s.averageHeartRate ?? 0,
    onsetLatencyMinutes: (s.latency ?? 0) / 60,
    remPct:
      s.totalSleepDuration > 0
        ? ((s.remSleepDuration ?? 0) / s.totalSleepDuration) * 100
        : 0,
    deepPct:
      s.totalSleepDuration > 0
        ? ((s.deepSleepDuration ?? 0) / s.totalSleepDuration) * 100
        : 0,
    efficiency: s.efficiency ?? 0,
    temperatureDelta: s.temperatureDelta ?? 0,
  };
}

function classifyDirection(
  sleepZ: number,
  bedtimeZ: number,
  wakeZ: number,
  hrvZ: number,
  hrZ: number
): "hyper" | "hypo" | null {
  // Hyper (possible hypomania): less sleep, earlier times, sometimes higher HRV
  const hyperSignals =
    (sleepZ < -1.5 ? 1 : 0) +
    (bedtimeZ < -1.5 ? 1 : 0) +
    (wakeZ < -1.5 ? 1 : 0);

  // Hypo (possible depression): more sleep, later times, lower HRV, higher HR
  const hypoSignals =
    (sleepZ > 1.5 ? 1 : 0) +
    (bedtimeZ > 1.5 ? 1 : 0) +
    (wakeZ > 1.5 ? 1 : 0) +
    (hrvZ < -1.5 ? 1 : 0) +
    (hrZ > 1.5 ? 1 : 0);

  if (hyperSignals >= 2) return "hyper";
  if (hypoSignals >= 2) return "hypo";
  return null;
}

function buildNotes(
  metrics: DayMetrics,
  baselines: Record<string, number>,
  zScores: Record<string, number>
): string {
  const notes: string[] = [];
  const sleepDelta = metrics.totalSleepMinutes - baselines.sleep;

  if (Math.abs(zScores.sleep) > 1.5) {
    const dir = sleepDelta > 0 ? "more" : "less";
    notes.push(
      `Sleep ${Math.abs(sleepDelta).toFixed(0)}min ${dir} than baseline`
    );
  }
  if (Math.abs(zScores.bedtime) > 1.5) {
    const dir = zScores.bedtime > 0 ? "later" : "earlier";
    notes.push(`Bedtime ${dir} than usual`);
  }
  if (Math.abs(zScores.wake) > 1.5) {
    const dir = zScores.wake > 0 ? "later" : "earlier";
    notes.push(`Wake time ${dir} than usual`);
  }
  if (Math.abs(zScores.hrv) > 1.5) {
    const dir = zScores.hrv < 0 ? "lower" : "higher";
    notes.push(`HRV ${dir} than baseline`);
  }
  if (Math.abs(zScores.hr) > 1.5) {
    const dir = zScores.hr > 0 ? "elevated" : "lower";
    notes.push(`Heart rate ${dir}`);
  }

  return notes.join(". ");
}

export async function analyzeDay(targetDay: string) {
  // Get the target day's sleep data
  const todaySleep = await db
    .select()
    .from(sleepPeriods)
    .where(
      and(
        eq(sleepPeriods.day, targetDay),
        eq(sleepPeriods.type, "long_sleep")
      )
    )
    .limit(1);

  if (todaySleep.length === 0) return null;

  const metrics = extractMetrics(todaySleep[0]);
  if (!metrics) return null;

  // Get prior 30 days for baseline (excluding target day)
  const priorSleep = await db
    .select()
    .from(sleepPeriods)
    .where(
      and(
        lt(sleepPeriods.day, targetDay),
        sql`${sleepPeriods.type} = 'long_sleep'`
      )
    )
    .orderBy(desc(sleepPeriods.day))
    .limit(30);

  const priorMetrics = priorSleep
    .map(extractMetrics)
    .filter((m): m is DayMetrics => m !== null);

  if (priorMetrics.length < MIN_BASELINE_DAYS) return null;

  // Compute baselines
  const sleepVals = priorMetrics.map((m) => m.totalSleepMinutes);
  const bedtimeVals = priorMetrics.map((m) => m.bedtimeMinutes);
  const wakeVals = priorMetrics.map((m) => m.wakeTimeMinutes);
  const hrvVals = priorMetrics.filter((m) => m.avgHrv > 0).map((m) => m.avgHrv);
  const hrVals = priorMetrics.filter((m) => m.avgHeartRate > 0).map((m) => m.avgHeartRate);
  const latencyVals = priorMetrics.map((m) => m.onsetLatencyMinutes);

  const baselines = {
    sleep: trimmedMean(sleepVals),
    bedtime: trimmedMean(bedtimeVals),
    wake: trimmedMean(wakeVals),
    hrv: hrvVals.length > 0 ? trimmedMean(hrvVals) : 0,
    hr: hrVals.length > 0 ? trimmedMean(hrVals) : 0,
    latency: trimmedMean(latencyVals),
  };

  const stds = {
    sleep: standardDeviation(sleepVals, baselines.sleep),
    bedtime: standardDeviation(bedtimeVals, baselines.bedtime),
    wake: standardDeviation(wakeVals, baselines.wake),
    hrv: hrvVals.length > 0 ? standardDeviation(hrvVals, baselines.hrv) : 0,
    hr: hrVals.length > 0 ? standardDeviation(hrVals, baselines.hr) : 0,
    latency: standardDeviation(latencyVals, baselines.latency),
  };

  const zScores = {
    sleep: zScore(metrics.totalSleepMinutes, baselines.sleep, stds.sleep),
    bedtime: zScore(metrics.bedtimeMinutes, baselines.bedtime, stds.bedtime),
    wake: zScore(metrics.wakeTimeMinutes, baselines.wake, stds.wake),
    hrv: metrics.avgHrv > 0 ? zScore(metrics.avgHrv, baselines.hrv, stds.hrv) : 0,
    hr: metrics.avgHeartRate > 0 ? zScore(metrics.avgHeartRate, baselines.hr, stds.hr) : 0,
    latency: zScore(metrics.onsetLatencyMinutes, baselines.latency, stds.latency),
  };

  const compositeScore =
    WEIGHTS.sleepDuration * Math.abs(zScores.sleep) +
    WEIGHTS.bedtime * Math.abs(zScores.bedtime) +
    WEIGHTS.wakeTime * Math.abs(zScores.wake) +
    WEIGHTS.hrv * Math.abs(zScores.hrv) +
    WEIGHTS.heartRate * Math.abs(zScores.hr) +
    WEIGHTS.latency * Math.abs(zScores.latency);

  const isAnomaly =
    compositeScore > 1.5 || Math.abs(zScores.sleep) > 2.0;

  const direction = isAnomaly
    ? classifyDirection(zScores.sleep, zScores.bedtime, zScores.wake, zScores.hrv, zScores.hr)
    : null;

  const notes = isAnomaly
    ? buildNotes(metrics, baselines, zScores)
    : "";

  const now = Math.floor(Date.now() / 1000);

  await db
    .insert(dailyAnalysis)
    .values({
      day: targetDay,
      totalSleepMinutes: metrics.totalSleepMinutes,
      baselineSleepMinutes: baselines.sleep,
      sleepDurationZScore: zScores.sleep,
      bedtimeStartMinutes: metrics.bedtimeMinutes,
      baselineBedtimeMinutes: baselines.bedtime,
      bedtimeZScore: zScores.bedtime,
      wakeTimeMinutes: metrics.wakeTimeMinutes,
      baselineWakeMinutes: baselines.wake,
      wakeTimeZScore: zScores.wake,
      remPercentage: metrics.remPct,
      deepPercentage: metrics.deepPct,
      efficiency: metrics.efficiency,
      avgHrv: metrics.avgHrv,
      baselineHrv: baselines.hrv,
      hrvZScore: zScores.hrv,
      avgHeartRate: metrics.avgHeartRate,
      baselineHeartRate: baselines.hr,
      heartRateZScore: zScores.hr,
      temperatureDelta: metrics.temperatureDelta,
      onsetLatencyMinutes: metrics.onsetLatencyMinutes,
      baselineLatency: baselines.latency,
      latencyZScore: zScores.latency,
      anomalyScore: compositeScore,
      isAnomaly: isAnomaly ? 1 : 0,
      anomalyDirection: direction,
      anomalyNotes: notes || null,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: dailyAnalysis.day,
      set: {
        totalSleepMinutes: sql`excluded.total_sleep_minutes`,
        baselineSleepMinutes: sql`excluded.baseline_sleep_minutes`,
        sleepDurationZScore: sql`excluded.sleep_duration_z_score`,
        bedtimeStartMinutes: sql`excluded.bedtime_start_minutes`,
        baselineBedtimeMinutes: sql`excluded.baseline_bedtime_minutes`,
        bedtimeZScore: sql`excluded.bedtime_z_score`,
        wakeTimeMinutes: sql`excluded.wake_time_minutes`,
        baselineWakeMinutes: sql`excluded.baseline_wake_minutes`,
        wakeTimeZScore: sql`excluded.wake_time_z_score`,
        remPercentage: sql`excluded.rem_percentage`,
        deepPercentage: sql`excluded.deep_percentage`,
        efficiency: sql`excluded.efficiency`,
        avgHrv: sql`excluded.avg_hrv`,
        baselineHrv: sql`excluded.baseline_hrv`,
        hrvZScore: sql`excluded.hrv_z_score`,
        avgHeartRate: sql`excluded.avg_heart_rate`,
        baselineHeartRate: sql`excluded.baseline_heart_rate`,
        heartRateZScore: sql`excluded.heart_rate_z_score`,
        temperatureDelta: sql`excluded.temperature_delta`,
        onsetLatencyMinutes: sql`excluded.onset_latency_minutes`,
        baselineLatency: sql`excluded.baseline_latency`,
        latencyZScore: sql`excluded.latency_z_score`,
        anomalyScore: sql`excluded.anomaly_score`,
        isAnomaly: sql`excluded.is_anomaly`,
        anomalyDirection: sql`excluded.anomaly_direction`,
        anomalyNotes: sql`excluded.anomaly_notes`,
      },
    });

  return { day: targetDay, compositeScore, isAnomaly, direction, notes };
}

export async function analyzeAllDays() {
  const allSleep = await db
    .select({ day: sleepPeriods.day })
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(sleepPeriods.day);

  const days = [...new Set(allSleep.map((s) => s.day))];
  const results = [];

  for (const day of days) {
    const result = await analyzeDay(day);
    if (result) results.push(result);
  }

  return results;
}
