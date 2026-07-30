import { db } from "@/lib/db";
import { sleepPeriods, dailyAnalysis, dailyReadiness } from "@/lib/db/schema";
import { desc, sql, and, lt, eq, inArray } from "drizzle-orm";
import {
  circularMeanMinutes,
  circularStandardDeviationMinutes,
  circularZScore,
  trimmedMean,
  standardDeviation,
  zScore,
  minutesFromMidnight,
} from "./baseline";
import { DetectionConfigValues, DEFAULT_CONFIG, BipolarType } from "./config";

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
  withinNightHrvCV: number;
  withinNightHrCV: number;
  sleepStageTransitions: number;
  hypnogramFragmentation: number;
  lowestHeartRate: number;
  averageBreath: number;
  steps: number;
  activeMinutes: number;
  activityClassFragmentation: number;
  stressHigh: number;
  recoveryHigh: number;
  resilienceLevel: string | null;
  sleepTimingScore: number;
  readinessScore: number;
  temperatureDeviation: number;
  temperatureTrendDeviation: number;
  dayToDaySleepCV: number;
  dayToDayBedtimeCV: number;
  dayToDayWakeCV: number;
  circadianIS: number;
  circadianIV: number;
  circadianRA: number;
  moodScore: number | null;
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
  averageSpo2: number | null;
  breathingDisturbanceIndex: number | null;
  episodeState: string | null;
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

function finiteValues(values: number[]): number[] {
  return values.filter(Number.isFinite);
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

export function extractMetrics(
  s: typeof sleepPeriods.$inferSelect
): DayMetrics | null {
  if (s.totalSleepDuration == null || s.totalSleepDuration <= 0) return null;
  const totalMin = s.totalSleepDuration / 60;
  return {
    day: s.day,
    totalSleepMinutes: totalMin,
    bedtimeMinutes: minutesFromMidnight(s.bedtimeStart),
    wakeTimeMinutes: minutesFromMidnight(s.bedtimeEnd),
    avgHrv: s.averageHrv ?? Number.NaN,
    avgHeartRate: s.averageHeartRate ?? Number.NaN,
    onsetLatencyMinutes: s.latency == null ? Number.NaN : s.latency / 60,
    remPct:
      s.remSleepDuration == null
        ? Number.NaN
        : (s.remSleepDuration / s.totalSleepDuration) * 100,
    deepPct:
      s.deepSleepDuration == null
        ? Number.NaN
        : (s.deepSleepDuration / s.totalSleepDuration) * 100,
    efficiency: s.efficiency ?? Number.NaN,
    temperatureDelta: Number.NaN,
    restlessPeriods: s.restlessPeriods ?? Number.NaN,
    lowestHeartRate: s.lowestHeartRate ?? Number.NaN,
    averageBreath: s.averageBreath ?? Number.NaN,
    withinNightHrvCV: Number.NaN,
    withinNightHrCV: Number.NaN,
    sleepStageTransitions: Number.NaN,
    hypnogramFragmentation: Number.NaN,
    steps: Number.NaN,
    activeMinutes: Number.NaN,
    activityClassFragmentation: Number.NaN,
    stressHigh: Number.NaN,
    recoveryHigh: Number.NaN,
    resilienceLevel: null,
    sleepTimingScore: Number.NaN,
    readinessScore: Number.NaN,
    temperatureDeviation: Number.NaN,
    temperatureTrendDeviation: Number.NaN,
    dayToDaySleepCV: Number.NaN,
    dayToDayBedtimeCV: Number.NaN,
    dayToDayWakeCV: Number.NaN,
    circadianIS: Number.NaN,
    circadianIV: Number.NaN,
    circadianRA: Number.NaN,
    moodScore: null,
    energyScore: null,
    irritabilityScore: null,
    anxietyScore: null,
    averageSpo2: null,
    breathingDisturbanceIndex: null,
    episodeState: null,
  };
}

function classifyDirection(
  zScores: Record<string, number>,
  metrics: DayMetrics,
  config: DetectionConfigValues
): "hyper" | "hypo" | null {
  const t = config.dailyAnomalyThreshold;
  const ep = metrics.episodeState;

  const hyperSignals =
    (zScores.sleep < -t ? 1 : 0) +
    (Math.abs(zScores.bedtime) > t && zScores.sleep < 0 ? 1 : 0) +
    (zScores.wake < -t ? 1 : 0) +
    (zScores.activity > t ? 1 : 0) +
    (ep === "hypomanic" || ep === "mixed" ? 1 : 0);

  const hypoSignals =
    (zScores.sleep > t ? 1 : 0) +
    (zScores.bedtime > t ? 1 : 0) +
    (zScores.wake > t ? 1 : 0) +
    (zScores.activity < -t ? 1 : 0) +
    (ep === "depressive" || ep === "mixed" ? 1 : 0);

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
  if (zScores.withinNightVar > threshold) {
    notes.push("Within-night sleep variability elevated");
  }
  if (Math.abs(zScores.activity) > threshold) {
    const dir = zScores.activity > 0 ? "increased" : "decreased";
    notes.push(`Activity level ${dir}`);
  }

  return notes.join(". ");
}

export function computeDailyAnalysis(
  metrics: DayMetrics,
  priorMetrics: DayMetrics[],
  config: DetectionConfigValues,
  bipolarType: BipolarType = "unspecified"
): DailyAnalysisResult | null {
  if (priorMetrics.length < config.minBaselineDays) return null;

  const trimPct = config.baselineTrimPct;
  const w = config.metricWeights;

  const sleepVals = finiteValues(priorMetrics.map((m) => m.totalSleepMinutes));
  const bedtimeVals = finiteValues(priorMetrics.map((m) => m.bedtimeMinutes));
  const wakeVals = finiteValues(priorMetrics.map((m) => m.wakeTimeMinutes));
  const hrvVals = finiteValues(priorMetrics.map((m) => m.avgHrv));
  const hrVals = finiteValues(priorMetrics.map((m) => m.avgHeartRate));
  const latencyVals = finiteValues(priorMetrics.map((m) => m.onsetLatencyMinutes));
  const tempVals = finiteValues(priorMetrics.map((m) => m.temperatureDeviation));
  const restlessVals = finiteValues(priorMetrics.map((m) => m.restlessPeriods));
  const efficiencyVals = finiteValues(priorMetrics.map((m) => m.efficiency));
  const deepPctVals = finiteValues(priorMetrics.map((m) => m.deepPct));
  const remPctVals = finiteValues(priorMetrics.map((m) => m.remPct));

  const withinNightHrvCVVals = finiteValues(priorMetrics.map((m) => m.withinNightHrvCV));
  const withinNightHrCVVals = finiteValues(priorMetrics.map((m) => m.withinNightHrCV));
  const hypnogramFragVals = finiteValues(priorMetrics.map((m) => m.hypnogramFragmentation));
  const stepsVals = finiteValues(priorMetrics.map((m) => m.steps));
  const activeMinVals = finiteValues(priorMetrics.map((m) => m.activeMinutes));
  const circadianIVVals = finiteValues(priorMetrics.map((m) => m.circadianIV));
  const circadianISVals = finiteValues(priorMetrics.map((m) => m.circadianIS));

  const baselines: Record<string, number> = {
    sleep: trimmedMean(sleepVals, trimPct),
    bedtime: circularMeanMinutes(bedtimeVals),
    wake: circularMeanMinutes(wakeVals),
    hrv: trimmedMean(hrvVals, trimPct),
    hr: trimmedMean(hrVals, trimPct),
    latency: trimmedMean(latencyVals, trimPct),
    temperature: trimmedMean(tempVals, trimPct),
    restlessness: trimmedMean(restlessVals, trimPct),
    efficiency: trimmedMean(efficiencyVals, trimPct),
    deepPct: trimmedMean(deepPctVals, trimPct),
    remPct: trimmedMean(remPctVals, trimPct),
    withinNightHrvCV: trimmedMean(withinNightHrvCVVals, trimPct),
    withinNightHrCV: trimmedMean(withinNightHrCVVals, trimPct),
    hypnogramFrag: trimmedMean(hypnogramFragVals, trimPct),
    steps: trimmedMean(stepsVals, trimPct),
    activeMinutes: trimmedMean(activeMinVals, trimPct),
    circadianIV: trimmedMean(circadianIVVals, trimPct),
    circadianIS: trimmedMean(circadianISVals, trimPct),
  };

  const stds: Record<string, number> = {
    sleep: standardDeviation(sleepVals, baselines.sleep),
    bedtime: circularStandardDeviationMinutes(bedtimeVals, baselines.bedtime),
    wake: circularStandardDeviationMinutes(wakeVals, baselines.wake),
    hrv: standardDeviation(hrvVals, baselines.hrv),
    hr: standardDeviation(hrVals, baselines.hr),
    latency: standardDeviation(latencyVals, baselines.latency),
    temperature: standardDeviation(tempVals, baselines.temperature),
    restlessness: standardDeviation(restlessVals, baselines.restlessness),
    efficiency: standardDeviation(efficiencyVals, baselines.efficiency),
    deepPct: standardDeviation(deepPctVals, baselines.deepPct),
    remPct: standardDeviation(remPctVals, baselines.remPct),
    withinNightHrvCV: standardDeviation(withinNightHrvCVVals, baselines.withinNightHrvCV),
    withinNightHrCV: standardDeviation(withinNightHrCVVals, baselines.withinNightHrCV),
    hypnogramFrag: standardDeviation(hypnogramFragVals, baselines.hypnogramFrag),
    steps: standardDeviation(stepsVals, baselines.steps),
    activeMinutes: standardDeviation(activeMinVals, baselines.activeMinutes),
    circadianIV: standardDeviation(circadianIVVals, baselines.circadianIV),
    circadianIS: standardDeviation(circadianISVals, baselines.circadianIS),
  };

  const zScores: Record<string, number> = {
    sleep: zScore(metrics.totalSleepMinutes, baselines.sleep, stds.sleep),
    bedtime: circularZScore(metrics.bedtimeMinutes, baselines.bedtime, stds.bedtime),
    wake: circularZScore(metrics.wakeTimeMinutes, baselines.wake, stds.wake),
    hrv: zScore(metrics.avgHrv, baselines.hrv, stds.hrv),
    hr: zScore(metrics.avgHeartRate, baselines.hr, stds.hr),
    latency: zScore(metrics.onsetLatencyMinutes, baselines.latency, stds.latency),
    temperature: zScore(metrics.temperatureDeviation, baselines.temperature, stds.temperature),
    restlessness: zScore(metrics.restlessPeriods, baselines.restlessness, stds.restlessness),
    efficiency: zScore(metrics.efficiency, baselines.efficiency, stds.efficiency),
    deepPct: zScore(metrics.deepPct, baselines.deepPct, stds.deepPct),
    remPct: zScore(metrics.remPct, baselines.remPct, stds.remPct),
    withinNightHrvCV: zScore(metrics.withinNightHrvCV, baselines.withinNightHrvCV, stds.withinNightHrvCV),
    withinNightHrCV: zScore(metrics.withinNightHrCV, baselines.withinNightHrCV, stds.withinNightHrCV),
    hypnogramFrag: zScore(metrics.hypnogramFragmentation, baselines.hypnogramFrag, stds.hypnogramFrag),
    steps: zScore(metrics.steps, baselines.steps, stds.steps),
    activeMinutes: zScore(metrics.activeMinutes, baselines.activeMinutes, stds.activeMinutes),
    circadianIV: zScore(metrics.circadianIV, baselines.circadianIV, stds.circadianIV),
    circadianIS: zScore(metrics.circadianIS, baselines.circadianIS, stds.circadianIS),
  };

  const moodVals = priorMetrics.filter((m) => m.moodScore != null).map((m) => m.moodScore!);
  const energyVals = priorMetrics.filter((m) => m.energyScore != null).map((m) => m.energyScore!);
  const irritabilityVals = priorMetrics.filter((m) => m.irritabilityScore != null).map((m) => m.irritabilityScore!);

  if (moodVals.length >= 5) {
    baselines.mood = trimmedMean(moodVals, trimPct);
    stds.mood = standardDeviation(moodVals, baselines.mood);
    zScores.mood = metrics.moodScore != null ? zScore(metrics.moodScore, baselines.mood, stds.mood) : 0;
  }
  if (energyVals.length >= 5) {
    baselines.energy = trimmedMean(energyVals, trimPct);
    stds.energy = standardDeviation(energyVals, baselines.energy);
    zScores.energy = metrics.energyScore != null ? zScore(metrics.energyScore, baselines.energy, stds.energy) : 0;
  }
  if (irritabilityVals.length >= 5) {
    baselines.irritability = trimmedMean(irritabilityVals, trimPct);
    stds.irritability = standardDeviation(irritabilityVals, baselines.irritability);
    zScores.irritability = metrics.irritabilityScore != null ? zScore(metrics.irritabilityScore, baselines.irritability, stds.irritability) : 0;
  }

  const withinNightVarZ = Math.max(
    zScores.withinNightHrvCV,
    zScores.withinNightHrCV,
    zScores.hypnogramFrag
  );
  zScores.withinNightVar = withinNightVarZ;

  const activityZ = Number.isFinite(metrics.steps)
    ? zScores.steps
    : zScores.activeMinutes;
  zScores.activity = activityZ;

  const circadianZ = zScores.circadianIV;
  zScores.circadianReg = circadianZ;

  const effectiveWeights = { ...w };
  if (bipolarType === "bp2") {
    effectiveWeights.withinNightVariability = 0.10;
    effectiveWeights.sleepDuration = 0.11;
  }

  let compositeScore =
    effectiveWeights.sleepDuration * Math.abs(zScores.sleep) +
    effectiveWeights.bedtimeShift * Math.abs(zScores.bedtime) +
    effectiveWeights.wakeTimeShift * Math.abs(zScores.wake) +
    effectiveWeights.hrv * Math.abs(zScores.hrv) +
    effectiveWeights.heartRate * Math.abs(zScores.hr) +
    effectiveWeights.latency * Math.abs(zScores.latency) +
    effectiveWeights.temperatureDelta * Math.abs(zScores.temperature) +
    effectiveWeights.restlessPeriods * Math.abs(zScores.restlessness) +
    effectiveWeights.sleepEfficiency * Math.abs(zScores.efficiency) +
    effectiveWeights.deepPct * Math.abs(zScores.deepPct) +
    effectiveWeights.remPct * Math.abs(zScores.remPct) +
    effectiveWeights.withinNightVariability * Math.abs(withinNightVarZ) +
    effectiveWeights.activityLevel * Math.abs(activityZ) +
    effectiveWeights.circadianRegularity * Math.abs(circadianZ) +
    (effectiveWeights.mood ?? 0) * Math.abs(zScores.mood ?? 0) +
    (effectiveWeights.energy ?? 0) * Math.abs(zScores.energy ?? 0) +
    (effectiveWeights.irritability ?? 0) * Math.abs(zScores.irritability ?? 0);

  if (metrics.episodeState && metrics.episodeState !== "none") {
    compositeScore += 0.3;
  }

  const hrvCrash =
    Number.isFinite(metrics.avgHrv) &&
    Number.isFinite(baselines.hrv) &&
    metrics.avgHrv < baselines.hrv * 0.7 &&
    zScores.hr > 1.0;

  const abs = config.absoluteThresholds;
  let absoluteBonus = 0;
  if (
    Number.isFinite(metrics.totalSleepMinutes) &&
    metrics.totalSleepMinutes < abs.minSleepMinutes
  ) {
    absoluteBonus += 0.5;
  }
  if (
    Number.isFinite(metrics.avgHeartRate) &&
    metrics.avgHeartRate > abs.maxHeartRate
  ) {
    absoluteBonus += 0.5;
  }
  if (Number.isFinite(metrics.avgHrv) && metrics.avgHrv < abs.minHrv) {
    absoluteBonus += 0.5;
  }
  if (
    Number.isFinite(metrics.efficiency) &&
    metrics.efficiency < abs.minEfficiency
  ) {
    absoluteBonus += 0.3;
  }
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

  const [todayReadiness, priorSleep] = await Promise.all([
    db
      .select({
        temperatureDeviation: dailyReadiness.temperatureDeviation,
        temperatureTrendDeviation: dailyReadiness.temperatureTrendDeviation,
        score: dailyReadiness.score,
      })
      .from(dailyReadiness)
      .where(eq(dailyReadiness.day, targetDay))
      .limit(1),
    db
      .select()
      .from(sleepPeriods)
      .where(
        and(
          lt(sleepPeriods.day, targetDay),
          sql`${sleepPeriods.type} = 'long_sleep'`
        )
      )
      .orderBy(desc(sleepPeriods.day))
      .limit(cfg.baselineDays),
  ]);

  const readiness = todayReadiness[0];
  if (readiness) {
    metrics.readinessScore = readiness.score ?? Number.NaN;
    metrics.temperatureDeviation =
      readiness.temperatureDeviation ?? Number.NaN;
    metrics.temperatureDelta = metrics.temperatureDeviation;
    metrics.temperatureTrendDeviation =
      readiness.temperatureTrendDeviation ?? Number.NaN;
  }

  const priorMetrics = priorSleep
    .map(extractMetrics)
    .filter((m): m is DayMetrics => m !== null);

  const priorDays = priorMetrics.map((metric) => metric.day);
  if (priorDays.length > 0) {
    const priorReadiness = await db
      .select({
        day: dailyReadiness.day,
        temperatureDeviation: dailyReadiness.temperatureDeviation,
        temperatureTrendDeviation: dailyReadiness.temperatureTrendDeviation,
        score: dailyReadiness.score,
      })
      .from(dailyReadiness)
      .where(inArray(dailyReadiness.day, priorDays));
    const readinessByDay = new Map(
      priorReadiness.map((row) => [row.day, row])
    );
    for (const priorMetric of priorMetrics) {
      const priorDayReadiness = readinessByDay.get(priorMetric.day);
      if (!priorDayReadiness) continue;
      priorMetric.readinessScore =
        priorDayReadiness.score ?? Number.NaN;
      priorMetric.temperatureDeviation =
        priorDayReadiness.temperatureDeviation ?? Number.NaN;
      priorMetric.temperatureDelta = priorMetric.temperatureDeviation;
      priorMetric.temperatureTrendDeviation =
        priorDayReadiness.temperatureTrendDeviation ?? Number.NaN;
    }
  }

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
      baselineSleepMinutes: finiteOrNull(baselines.sleep),
      sleepDurationZScore: finiteOrNull(zScores.sleep),
      bedtimeStartMinutes: finiteOrNull(metrics.bedtimeMinutes),
      baselineBedtimeMinutes: finiteOrNull(baselines.bedtime),
      bedtimeZScore: finiteOrNull(zScores.bedtime),
      wakeTimeMinutes: finiteOrNull(metrics.wakeTimeMinutes),
      baselineWakeMinutes: finiteOrNull(baselines.wake),
      wakeTimeZScore: finiteOrNull(zScores.wake),
      remPercentage: finiteOrNull(metrics.remPct),
      deepPercentage: finiteOrNull(metrics.deepPct),
      efficiency: finiteOrNull(metrics.efficiency),
      avgHrv: finiteOrNull(metrics.avgHrv),
      baselineHrv: finiteOrNull(baselines.hrv),
      hrvZScore: finiteOrNull(zScores.hrv),
      avgHeartRate: finiteOrNull(metrics.avgHeartRate),
      baselineHeartRate: finiteOrNull(baselines.hr),
      heartRateZScore: finiteOrNull(zScores.hr),
      temperatureDelta: finiteOrNull(metrics.temperatureDeviation),
      onsetLatencyMinutes: finiteOrNull(metrics.onsetLatencyMinutes),
      baselineLatency: finiteOrNull(baselines.latency),
      latencyZScore: finiteOrNull(zScores.latency),
      temperatureZScore: finiteOrNull(zScores.temperature),
      baselineTemperature: finiteOrNull(baselines.temperature),
      restlessnessZScore: finiteOrNull(zScores.restlessness),
      baselineRestlessness: finiteOrNull(baselines.restlessness),
      efficiencyZScore: finiteOrNull(zScores.efficiency),
      baselineEfficiency: finiteOrNull(baselines.efficiency),
      deepPctZScore: finiteOrNull(zScores.deepPct),
      baselineDeepPct: finiteOrNull(baselines.deepPct),
      remPctZScore: finiteOrNull(zScores.remPct),
      baselineRemPct: finiteOrNull(baselines.remPct),
      restlessPeriods: finiteOrNull(metrics.restlessPeriods),
      anomalyScore: compositeScore,
      isAnomaly: isAnomaly ? 1 : 0,
      anomalyDirection: direction,
      anomalyNotes: notes || null,
      withinNightHrvCV: finiteOrNull(metrics.withinNightHrvCV),
      withinNightHrCV: finiteOrNull(metrics.withinNightHrCV),
      sleepStageTransitions: finiteOrNull(metrics.sleepStageTransitions),
      hypnogramFragmentation: finiteOrNull(metrics.hypnogramFragmentation),
      lowestHeartRate: finiteOrNull(metrics.lowestHeartRate),
      averageBreath: finiteOrNull(metrics.averageBreath),
      activityScore: null,
      steps: finiteOrNull(metrics.steps),
      activeMinutes: finiteOrNull(metrics.activeMinutes),
      sedentaryMinutes: null,
      activityClassFragmentation: finiteOrNull(metrics.activityClassFragmentation),
      stressHigh: finiteOrNull(metrics.stressHigh),
      recoveryHigh: finiteOrNull(metrics.recoveryHigh),
      resilienceLevel: metrics.resilienceLevel,
      sleepTimingScore: finiteOrNull(metrics.sleepTimingScore),
      readinessScore: finiteOrNull(metrics.readinessScore),
      temperatureDeviation: finiteOrNull(metrics.temperatureDeviation),
      temperatureTrendDeviation: finiteOrNull(metrics.temperatureTrendDeviation),
      dayToDaySleepCV: finiteOrNull(metrics.dayToDaySleepCV),
      dayToDayBedtimeCV: finiteOrNull(metrics.dayToDayBedtimeCV),
      dayToDayWakeCV: finiteOrNull(metrics.dayToDayWakeCV),
      circadianIS: finiteOrNull(metrics.circadianIS),
      circadianIV: finiteOrNull(metrics.circadianIV),
      circadianRA: finiteOrNull(metrics.circadianRA),
      averageSpo2: metrics.averageSpo2 ?? null,
      breathingDisturbanceIndex: metrics.breathingDisturbanceIndex ?? null,
      moodScore: metrics.moodScore ?? null,
      energyScore: metrics.energyScore ?? null,
      irritabilityScore: metrics.irritabilityScore ?? null,
      anxietyScore: metrics.anxietyScore ?? null,
      selfReportedEpisode: metrics.episodeState ?? null,
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
        withinNightHrvCV: sql`excluded.within_night_hrv_cv`,
        withinNightHrCV: sql`excluded.within_night_hr_cv`,
        sleepStageTransitions: sql`excluded.sleep_stage_transitions`,
        hypnogramFragmentation: sql`excluded.hypnogram_fragmentation`,
        lowestHeartRate: sql`excluded.lowest_heart_rate`,
        averageBreath: sql`excluded.average_breath`,
        activityScore: sql`excluded.activity_score`,
        steps: sql`excluded.steps`,
        activeMinutes: sql`excluded.active_minutes`,
        sedentaryMinutes: sql`excluded.sedentary_minutes`,
        activityClassFragmentation: sql`excluded.activity_class_fragmentation`,
        stressHigh: sql`excluded.stress_high`,
        recoveryHigh: sql`excluded.recovery_high`,
        resilienceLevel: sql`excluded.resilience_level`,
        sleepTimingScore: sql`excluded.sleep_timing_score`,
        readinessScore: sql`excluded.readiness_score`,
        temperatureDeviation: sql`excluded.temperature_deviation`,
        temperatureTrendDeviation: sql`excluded.temperature_trend_deviation`,
        dayToDaySleepCV: sql`excluded.day_to_day_sleep_cv`,
        dayToDayBedtimeCV: sql`excluded.day_to_day_bedtime_cv`,
        dayToDayWakeCV: sql`excluded.day_to_day_wake_cv`,
        circadianIS: sql`excluded.circadian_is`,
        circadianIV: sql`excluded.circadian_iv`,
        circadianRA: sql`excluded.circadian_ra`,
        averageSpo2: sql`excluded.average_spo2`,
        breathingDisturbanceIndex: sql`excluded.breathing_disturbance_index`,
        moodScore: sql`excluded.mood_score`,
        energyScore: sql`excluded.energy_score`,
        irritabilityScore: sql`excluded.irritability_score`,
        anxietyScore: sql`excluded.anxiety_score`,
        selfReportedEpisode: sql`excluded.self_reported_episode`,
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
