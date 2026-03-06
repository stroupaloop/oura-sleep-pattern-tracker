import { db } from "@/lib/db";
import { sleepPeriods, dailyAnalysis } from "@/lib/db/schema";
import { desc, sql, and, lt, eq } from "drizzle-orm";
import {
  trimmedMean,
  standardDeviation,
  zScore,
  minutesFromMidnight,
} from "./baseline";
import { DetectionConfigValues, DEFAULT_CONFIG, BipolarType, getBipolarProfile } from "./config";

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
    lowestHeartRate: s.lowestHeartRate ?? 0,
    averageBreath: s.averageBreath ?? 0,
    withinNightHrvCV: 0,
    withinNightHrCV: 0,
    sleepStageTransitions: 0,
    hypnogramFragmentation: 0,
    steps: 0,
    activeMinutes: 0,
    activityClassFragmentation: 0,
    stressHigh: 0,
    recoveryHigh: 0,
    resilienceLevel: null,
    sleepTimingScore: 0,
    readinessScore: 0,
    temperatureDeviation: 0,
    temperatureTrendDeviation: 0,
    dayToDaySleepCV: 0,
    dayToDayBedtimeCV: 0,
    dayToDayWakeCV: 0,
    circadianIS: 0,
    circadianIV: 0,
    circadianRA: 0,
    moodScore: null,
    energyScore: null,
    irritabilityScore: null,
    anxietyScore: null,
    averageSpo2: null,
    breathingDisturbanceIndex: null,
  };
}

function classifyDirection(
  zScores: Record<string, number>,
  metrics: DayMetrics,
  config: DetectionConfigValues,
  bipolarType: BipolarType = "unspecified"
): "hyper" | "hypo" | null {
  const t = config.dailyAnomalyThreshold;
  const abs = config.absoluteThresholds;
  const profile = getBipolarProfile(bipolarType);

  const hyperSignals =
    (zScores.sleep < -t ? 1 : 0) +
    (Math.abs(zScores.bedtime) > t && zScores.sleep < 0 ? 1 : 0) +
    (zScores.wake < -t ? 1 : 0) +
    (zScores.temperature > t ? 1 : 0) +
    (zScores.hrv > t ? 1 : 0) +
    (zScores.activity > t ? 1 : 0) +
    (zScores.withinNightVar > t ? 1 : 0) +
    (zScores.circadianIV > t ? 1 : 0);

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
    (metrics.efficiency > 0 && metrics.efficiency < abs.minEfficiency ? 1 : 0) +
    (zScores.activity < -t ? 1 : 0) +
    (zScores.circadianIV < -t ? 1 : 0);

  const hyperThreshold = bipolarType === "bp2" ? 2 : 2;
  if (hyperSignals >= hyperThreshold) return "hyper";
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
  const profile = getBipolarProfile(bipolarType);

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

  const withinNightHrvCVVals = priorMetrics.filter((m) => m.withinNightHrvCV > 0).map((m) => m.withinNightHrvCV);
  const withinNightHrCVVals = priorMetrics.filter((m) => m.withinNightHrCV > 0).map((m) => m.withinNightHrCV);
  const hypnogramFragVals = priorMetrics.filter((m) => m.hypnogramFragmentation > 0).map((m) => m.hypnogramFragmentation);
  const stepsVals = priorMetrics.filter((m) => m.steps > 0).map((m) => m.steps);
  const activeMinVals = priorMetrics.filter((m) => m.activeMinutes > 0).map((m) => m.activeMinutes);
  const circadianIVVals = priorMetrics.filter((m) => m.circadianIV > 0).map((m) => m.circadianIV);
  const circadianISVals = priorMetrics.filter((m) => m.circadianIS > 0).map((m) => m.circadianIS);

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
    withinNightHrvCV: withinNightHrvCVVals.length > 0 ? trimmedMean(withinNightHrvCVVals, trimPct) : 0,
    withinNightHrCV: withinNightHrCVVals.length > 0 ? trimmedMean(withinNightHrCVVals, trimPct) : 0,
    hypnogramFrag: hypnogramFragVals.length > 0 ? trimmedMean(hypnogramFragVals, trimPct) : 0,
    steps: stepsVals.length > 0 ? trimmedMean(stepsVals, trimPct) : 0,
    activeMinutes: activeMinVals.length > 0 ? trimmedMean(activeMinVals, trimPct) : 0,
    circadianIV: circadianIVVals.length > 0 ? trimmedMean(circadianIVVals, trimPct) : 0,
    circadianIS: circadianISVals.length > 0 ? trimmedMean(circadianISVals, trimPct) : 0,
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
    withinNightHrvCV: withinNightHrvCVVals.length > 0 ? standardDeviation(withinNightHrvCVVals, baselines.withinNightHrvCV) : 0,
    withinNightHrCV: withinNightHrCVVals.length > 0 ? standardDeviation(withinNightHrCVVals, baselines.withinNightHrCV) : 0,
    hypnogramFrag: hypnogramFragVals.length > 0 ? standardDeviation(hypnogramFragVals, baselines.hypnogramFrag) : 0,
    steps: stepsVals.length > 0 ? standardDeviation(stepsVals, baselines.steps) : 0,
    activeMinutes: activeMinVals.length > 0 ? standardDeviation(activeMinVals, baselines.activeMinutes) : 0,
    circadianIV: circadianIVVals.length > 0 ? standardDeviation(circadianIVVals, baselines.circadianIV) : 0,
    circadianIS: circadianISVals.length > 0 ? standardDeviation(circadianISVals, baselines.circadianIS) : 0,
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
    withinNightHrvCV: metrics.withinNightHrvCV > 0 ? zScore(metrics.withinNightHrvCV, baselines.withinNightHrvCV, stds.withinNightHrvCV) : 0,
    withinNightHrCV: metrics.withinNightHrCV > 0 ? zScore(metrics.withinNightHrCV, baselines.withinNightHrCV, stds.withinNightHrCV) : 0,
    hypnogramFrag: metrics.hypnogramFragmentation > 0 ? zScore(metrics.hypnogramFragmentation, baselines.hypnogramFrag, stds.hypnogramFrag) : 0,
    steps: metrics.steps > 0 ? zScore(metrics.steps, baselines.steps, stds.steps) : 0,
    activeMinutes: metrics.activeMinutes > 0 ? zScore(metrics.activeMinutes, baselines.activeMinutes, stds.activeMinutes) : 0,
    circadianIV: metrics.circadianIV > 0 ? zScore(metrics.circadianIV, baselines.circadianIV, stds.circadianIV) : 0,
    circadianIS: metrics.circadianIS > 0 ? zScore(metrics.circadianIS, baselines.circadianIS, stds.circadianIS) : 0,
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

  const activityZ = metrics.steps > 0 ? zScores.steps : zScores.activeMinutes;
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

  const direction = isAnomaly ? classifyDirection(zScores, metrics, config, bipolarType) : null;
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
      withinNightHrvCV: metrics.withinNightHrvCV || null,
      withinNightHrCV: metrics.withinNightHrCV || null,
      sleepStageTransitions: metrics.sleepStageTransitions || null,
      hypnogramFragmentation: metrics.hypnogramFragmentation || null,
      lowestHeartRate: metrics.lowestHeartRate || null,
      averageBreath: metrics.averageBreath || null,
      activityScore: null,
      steps: metrics.steps || null,
      activeMinutes: metrics.activeMinutes || null,
      sedentaryMinutes: null,
      activityClassFragmentation: metrics.activityClassFragmentation || null,
      stressHigh: metrics.stressHigh || null,
      recoveryHigh: metrics.recoveryHigh || null,
      resilienceLevel: metrics.resilienceLevel,
      sleepTimingScore: metrics.sleepTimingScore || null,
      readinessScore: metrics.readinessScore || null,
      temperatureDeviation: metrics.temperatureDeviation || null,
      temperatureTrendDeviation: metrics.temperatureTrendDeviation || null,
      dayToDaySleepCV: metrics.dayToDaySleepCV || null,
      dayToDayBedtimeCV: metrics.dayToDayBedtimeCV || null,
      dayToDayWakeCV: metrics.dayToDayWakeCV || null,
      circadianIS: metrics.circadianIS || null,
      circadianIV: metrics.circadianIV || null,
      circadianRA: metrics.circadianRA || null,
      averageSpo2: metrics.averageSpo2 ?? null,
      breathingDisturbanceIndex: metrics.breathingDisturbanceIndex ?? null,
      moodScore: metrics.moodScore ?? null,
      energyScore: metrics.energyScore ?? null,
      irritabilityScore: metrics.irritabilityScore ?? null,
      anxietyScore: metrics.anxietyScore ?? null,
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
