import { db } from "@/lib/db";
import { sleepPeriods, dailyAnalysis } from "@/lib/db/schema";
import { desc, sql, and, lt, eq } from "drizzle-orm";
import {
  trimmedMean,
  standardDeviation,
  zScore,
  minutesFromMidnight,
} from "./baseline";
import { DetectionConfigValues, DEFAULT_CONFIG } from "./config";

export interface DayMetrics {
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
  restlessPeriods: number;
}

export interface DailyAnalysisResult {
  day: string;
  metrics: DayMetrics;
  baselines: Record<string, number>;
  zScores: Record<string, number>;
  compositeScore: number;
  isAnomaly: boolean;
  direction: "hyper" | "hypo" | null;
  notes: string;
  hrvCrash: boolean;
}

export function extractMetrics(
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
    restlessPeriods: s.restlessPeriods ?? 0,
  };
}

function classifyDirection(
  zScores: Record<string, number>,
  metrics: DayMetrics,
  config: DetectionConfigValues
): "hyper" | "hypo" | null {
  const t = config.dailyAnomalyThreshold;
  const abs = config.absoluteThresholds;

  const hyperSignals =
    (zScores.sleep < -t ? 1 : 0) +
    (zScores.bedtime < -t ? 1 : 0) +
    (zScores.wake < -t ? 1 : 0) +
    (zScores.temperature > t ? 1 : 0);

  const hypoSignals =
    (zScores.sleep > t ? 1 : 0) +
    (zScores.bedtime > t ? 1 : 0) +
    (zScores.wake > t ? 1 : 0) +
    (zScores.hrv < -t ? 1 : 0) +
    (zScores.hr > t ? 1 : 0) +
    (zScores.efficiency < -t ? 1 : 0) +
    (metrics.totalSleepMinutes < abs.minSleepMinutes ? 1 : 0) +
    (metrics.avgHeartRate > abs.maxHeartRate ? 1 : 0) +
    (metrics.avgHrv > 0 && metrics.avgHrv < abs.minHrv ? 1 : 0) +
    (metrics.efficiency > 0 && metrics.efficiency < abs.minEfficiency ? 1 : 0);

  if (hyperSignals >= 2) return "hyper";
  if (hypoSignals >= 2) return "hypo";
  return null;
}

function buildNotes(
  metrics: DayMetrics,
  baselines: Record<string, number>,
  zScores: Record<string, number>,
  threshold: number
): string {
  const notes: string[] = [];
  const sleepDelta = metrics.totalSleepMinutes - baselines.sleep;

  if (Math.abs(zScores.sleep) > threshold) {
    const dir = sleepDelta > 0 ? "more" : "less";
    notes.push(
      `Sleep ${Math.abs(sleepDelta).toFixed(0)}min ${dir} than baseline`
    );
  }
  if (Math.abs(zScores.bedtime) > threshold) {
    const dir = zScores.bedtime > 0 ? "later" : "earlier";
    notes.push(`Bedtime ${dir} than usual`);
  }
  if (Math.abs(zScores.wake) > threshold) {
    const dir = zScores.wake > 0 ? "later" : "earlier";
    notes.push(`Wake time ${dir} than usual`);
  }
  if (Math.abs(zScores.hrv) > threshold) {
    const dir = zScores.hrv < 0 ? "lower" : "higher";
    notes.push(`HRV ${dir} than baseline`);
  }
  if (Math.abs(zScores.hr) > threshold) {
    const dir = zScores.hr > 0 ? "elevated" : "lower";
    notes.push(`Heart rate ${dir}`);
  }
  if (Math.abs(zScores.temperature) > threshold) {
    const dir = zScores.temperature > 0 ? "elevated" : "lower";
    notes.push(`Temperature ${dir}`);
  }
  if (Math.abs(zScores.efficiency) > threshold) {
    const dir = zScores.efficiency < 0 ? "lower" : "higher";
    notes.push(`Sleep efficiency ${dir}`);
  }

  return notes.join(". ");
}

export function computeDailyAnalysis(
  metrics: DayMetrics,
  priorMetrics: DayMetrics[],
  config: DetectionConfigValues
): DailyAnalysisResult | null {
  if (priorMetrics.length < config.minBaselineDays) return null;

  const trimPct = config.baselineTrimPct;
  const w = config.metricWeights;

  const sleepVals = priorMetrics.map((m) => m.totalSleepMinutes);
  const bedtimeVals = priorMetrics.map((m) => m.bedtimeMinutes);
  const wakeVals = priorMetrics.map((m) => m.wakeTimeMinutes);
  const hrvVals = priorMetrics.filter((m) => m.avgHrv > 0).map((m) => m.avgHrv);
  const hrVals = priorMetrics.filter((m) => m.avgHeartRate > 0).map((m) => m.avgHeartRate);
  const latencyVals = priorMetrics.map((m) => m.onsetLatencyMinutes);
  const tempVals = priorMetrics.map((m) => m.temperatureDelta);
  const restlessVals = priorMetrics.map((m) => m.restlessPeriods);
  const efficiencyVals = priorMetrics.filter((m) => m.efficiency > 0).map((m) => m.efficiency);
  const deepPctVals = priorMetrics.filter((m) => m.deepPct > 0).map((m) => m.deepPct);
  const remPctVals = priorMetrics.filter((m) => m.remPct > 0).map((m) => m.remPct);

  const baselines: Record<string, number> = {
    sleep: trimmedMean(sleepVals, trimPct),
    bedtime: trimmedMean(bedtimeVals, trimPct),
    wake: trimmedMean(wakeVals, trimPct),
    hrv: hrvVals.length > 0 ? trimmedMean(hrvVals, trimPct) : 0,
    hr: hrVals.length > 0 ? trimmedMean(hrVals, trimPct) : 0,
    latency: trimmedMean(latencyVals, trimPct),
    temperature: trimmedMean(tempVals, trimPct),
    restlessness: trimmedMean(restlessVals, trimPct),
    efficiency: efficiencyVals.length > 0 ? trimmedMean(efficiencyVals, trimPct) : 0,
    deepPct: deepPctVals.length > 0 ? trimmedMean(deepPctVals, trimPct) : 0,
    remPct: remPctVals.length > 0 ? trimmedMean(remPctVals, trimPct) : 0,
  };

  const stds: Record<string, number> = {
    sleep: standardDeviation(sleepVals, baselines.sleep),
    bedtime: standardDeviation(bedtimeVals, baselines.bedtime),
    wake: standardDeviation(wakeVals, baselines.wake),
    hrv: hrvVals.length > 0 ? standardDeviation(hrvVals, baselines.hrv) : 0,
    hr: hrVals.length > 0 ? standardDeviation(hrVals, baselines.hr) : 0,
    latency: standardDeviation(latencyVals, baselines.latency),
    temperature: standardDeviation(tempVals, baselines.temperature),
    restlessness: standardDeviation(restlessVals, baselines.restlessness),
    efficiency: efficiencyVals.length > 0 ? standardDeviation(efficiencyVals, baselines.efficiency) : 0,
    deepPct: deepPctVals.length > 0 ? standardDeviation(deepPctVals, baselines.deepPct) : 0,
    remPct: remPctVals.length > 0 ? standardDeviation(remPctVals, baselines.remPct) : 0,
  };

  const zScores: Record<string, number> = {
    sleep: zScore(metrics.totalSleepMinutes, baselines.sleep, stds.sleep),
    bedtime: zScore(metrics.bedtimeMinutes, baselines.bedtime, stds.bedtime),
    wake: zScore(metrics.wakeTimeMinutes, baselines.wake, stds.wake),
    hrv: metrics.avgHrv > 0 ? zScore(metrics.avgHrv, baselines.hrv, stds.hrv) : 0,
    hr: metrics.avgHeartRate > 0 ? zScore(metrics.avgHeartRate, baselines.hr, stds.hr) : 0,
    latency: zScore(metrics.onsetLatencyMinutes, baselines.latency, stds.latency),
    temperature: zScore(metrics.temperatureDelta, baselines.temperature, stds.temperature),
    restlessness: zScore(metrics.restlessPeriods, baselines.restlessness, stds.restlessness),
    efficiency: metrics.efficiency > 0 ? zScore(metrics.efficiency, baselines.efficiency, stds.efficiency) : 0,
    deepPct: metrics.deepPct > 0 ? zScore(metrics.deepPct, baselines.deepPct, stds.deepPct) : 0,
    remPct: metrics.remPct > 0 ? zScore(metrics.remPct, baselines.remPct, stds.remPct) : 0,
  };

  let compositeScore =
    w.sleepDuration * Math.abs(zScores.sleep) +
    w.bedtimeShift * Math.abs(zScores.bedtime) +
    w.wakeTimeShift * Math.abs(zScores.wake) +
    w.hrv * Math.abs(zScores.hrv) +
    w.heartRate * Math.abs(zScores.hr) +
    w.latency * Math.abs(zScores.latency) +
    w.temperatureDelta * Math.abs(zScores.temperature) +
    w.restlessPeriods * Math.abs(zScores.restlessness) +
    w.sleepEfficiency * Math.abs(zScores.efficiency);

  const hrvCrash =
    metrics.avgHrv > 0 &&
    baselines.hrv > 0 &&
    metrics.avgHrv < baselines.hrv * 0.7 &&
    zScores.hr > 1.0;

  const abs = config.absoluteThresholds;
  let absoluteBonus = 0;
  if (metrics.totalSleepMinutes < abs.minSleepMinutes) absoluteBonus += 0.5;
  if (metrics.avgHeartRate > abs.maxHeartRate) absoluteBonus += 0.5;
  if (metrics.avgHrv > 0 && metrics.avgHrv < abs.minHrv) absoluteBonus += 0.5;
  if (metrics.efficiency > 0 && metrics.efficiency < abs.minEfficiency) absoluteBonus += 0.3;
  compositeScore += absoluteBonus;

  const isAnomaly =
    compositeScore > config.dailyAnomalyThreshold ||
    Math.abs(zScores.sleep) > 2.0;

  const direction = isAnomaly ? classifyDirection(zScores, metrics, config) : null;
  const notes = isAnomaly
    ? buildNotes(metrics, baselines, zScores, config.dailyAnomalyThreshold)
    : "";

  return {
    day: metrics.day,
    metrics,
    baselines,
    zScores,
    compositeScore,
    isAnomaly,
    direction,
    notes,
    hrvCrash,
  };
}

export async function analyzeDay(targetDay: string, config?: DetectionConfigValues) {
  const cfg = config ?? DEFAULT_CONFIG;

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
    .limit(cfg.baselineDays);

  const priorMetrics = priorSleep
    .map(extractMetrics)
    .filter((m): m is DayMetrics => m !== null);

  const result = computeDailyAnalysis(metrics, priorMetrics, cfg);
  if (!result) return null;

  await upsertDailyAnalysis(result);

  return {
    day: targetDay,
    compositeScore: result.compositeScore,
    isAnomaly: result.isAnomaly,
    direction: result.direction,
    notes: result.notes,
  };
}

export async function upsertDailyAnalysis(result: DailyAnalysisResult) {
  const { metrics, baselines, zScores, compositeScore, isAnomaly, direction, notes } = result;
  const now = Math.floor(Date.now() / 1000);

  await db
    .insert(dailyAnalysis)
    .values({
      day: result.day,
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
      temperatureZScore: zScores.temperature,
      baselineTemperature: baselines.temperature,
      restlessnessZScore: zScores.restlessness,
      baselineRestlessness: baselines.restlessness,
      efficiencyZScore: zScores.efficiency,
      baselineEfficiency: baselines.efficiency,
      deepPctZScore: zScores.deepPct,
      baselineDeepPct: baselines.deepPct,
      remPctZScore: zScores.remPct,
      baselineRemPct: baselines.remPct,
      restlessPeriods: metrics.restlessPeriods,
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
        temperatureZScore: sql`excluded.temperature_z_score`,
        baselineTemperature: sql`excluded.baseline_temperature`,
        restlessnessZScore: sql`excluded.restlessness_z_score`,
        baselineRestlessness: sql`excluded.baseline_restlessness`,
        efficiencyZScore: sql`excluded.efficiency_z_score`,
        baselineEfficiency: sql`excluded.baseline_efficiency`,
        deepPctZScore: sql`excluded.deep_pct_z_score`,
        baselineDeepPct: sql`excluded.baseline_deep_pct`,
        remPctZScore: sql`excluded.rem_pct_z_score`,
        baselineRemPct: sql`excluded.baseline_rem_pct`,
        restlessPeriods: sql`excluded.restless_periods`,
        anomalyScore: sql`excluded.anomaly_score`,
        isAnomaly: sql`excluded.is_anomaly`,
        anomalyDirection: sql`excluded.anomaly_direction`,
        anomalyNotes: sql`excluded.anomaly_notes`,
      },
    });
}

export async function analyzeAllDays(config?: DetectionConfigValues) {
  const cfg = config ?? DEFAULT_CONFIG;

  const allSleep = await db
    .select({ day: sleepPeriods.day })
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(sleepPeriods.day);

  const days = [...new Set(allSleep.map((s) => s.day))];
  const results = [];

  for (const day of days) {
    const result = await analyzeDay(day, cfg);
    if (result) results.push(result);
  }

  return results;
}
