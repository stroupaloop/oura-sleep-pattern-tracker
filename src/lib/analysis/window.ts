import {
  circularVariation,
  coefficientOfVariation,
  isNextCalendarDay,
  zScore,
  standardDeviation,
  trimmedMean,
} from "./baseline";
import { DetectionConfigValues, BipolarType, getBipolarProfile } from "./config";
import { DailyAnalysisResult } from "./anomaly";

export interface WindowResult {
  windowDays: number;
  trendSlope: number;
  consistencyRatio: number;
  directionConsistency: number;
  bounceBackScore: number;
  latencyCV: number;
  latencyCVZScore: number;
  bedtimeCV: number;
  bedtimeCVZScore: number;
  sleepDurationCV: number;
  hrvCV: number;
  temperatureMean: number;
  temperatureElevated: boolean;
  missingDaysInWindow: number;
  hrvCrashDays: number;
  confidence: number;
  direction: "hyper" | "hypo" | null;
}

export function trendSlope(scores: number[]): number {
  if (scores.length < 2) return 0;
  const n = scores.length;
  const xMean = (n - 1) / 2;
  const yMean = scores.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (scores[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function consistencyRatio(scores: number[], concernThreshold: number): number {
  if (scores.length === 0) return 0;
  const concerning = scores.filter((s) => s > concernThreshold).length;
  return concerning / scores.length;
}

export function directionConsistencyScore(directions: (string | null)[]): { ratio: number; dominant: "hyper" | "hypo" | null } {
  const nonNull = directions.filter((d): d is string => d !== null);
  if (nonNull.length === 0) return { ratio: 0, dominant: null };

  const hyperCount = nonNull.filter((d) => d === "hyper").length;
  const hypoCount = nonNull.filter((d) => d === "hypo").length;

  if (hyperCount >= hypoCount) {
    return { ratio: hyperCount / nonNull.length, dominant: hyperCount > 0 ? "hyper" : null };
  }
  return { ratio: hypoCount / nonNull.length, dominant: hypoCount > 0 ? "hypo" : null };
}

export function bounceBackScore(scores: number[]): number {
  if (scores.length < 2) return 0;
  const peak = Math.max(...scores);
  if (peak < 0.5) return 0;
  const last = scores[scores.length - 1];
  return Math.max(0, Math.min(1, 1 - last / peak));
}

export function temperatureTrend(tempDeltas: number[]): { mean: number; elevated: boolean } {
  const finite = tempDeltas.filter(Number.isFinite);
  if (finite.length === 0) return { mean: Number.NaN, elevated: false };
  const mean = finite.reduce((s, v) => s + v, 0) / finite.length;
  let consecutiveElevated = 0;
  let maxConsecutive = 0;
  for (const t of tempDeltas) {
    if (Number.isFinite(t) && t > 0.5) {
      consecutiveElevated++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveElevated);
    } else {
      consecutiveElevated = 0;
    }
  }
  return { mean, elevated: maxConsecutive >= 3 };
}

export function normalizeEvidenceScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(10, Math.max(0, value));
}

const WINDOW_MULTIPLIERS: Record<number, number> = { 3: 0.6, 5: 0.85, 7: 1.0 };

function shiftCalendarDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function consecutiveWindows(
  results: DailyAnalysisResult[],
  windowDays: number,
  select: (result: DailyAnalysisResult) => number
): number[][] {
  const ordered = [...results].sort((a, b) => a.day.localeCompare(b.day));
  const windows: number[][] = [];
  for (let end = windowDays - 1; end < ordered.length; end++) {
    const slice = ordered.slice(end - windowDays + 1, end + 1);
    const isConsecutive = slice.every(
      (result, index) =>
        index === 0 || isNextCalendarDay(slice[index - 1].day, result.day)
    );
    const values = slice.map(select);
    if (isConsecutive && values.every(Number.isFinite)) windows.push(values);
  }
  return windows;
}

export function analyzeWindow(
  dailyResults: DailyAnalysisResult[],
  windowDays: number,
  allPriorMetrics: DailyAnalysisResult[],
  config: DetectionConfigValues,
  expectedDays?: number,
  bipolarType: BipolarType = "unspecified"
): WindowResult | null {
  if (dailyResults.length < 2) return null;

  const orderedResults = [...dailyResults].sort((a, b) =>
    a.day.localeCompare(b.day)
  );
  const latestDay = orderedResults[orderedResults.length - 1].day;
  const earliestDay = shiftCalendarDay(latestDay, -(windowDays - 1));
  const windowData = orderedResults.filter(
    (result) => result.day >= earliestDay && result.day <= latestDay
  );
  if (windowData.length < 2) return null;

  const scores = windowData.map((d) => d.compositeScore);
  const directions = windowData.map((d) => d.direction);

  const slope = trendSlope(scores);
  const consistency = consistencyRatio(scores, config.concernThreshold);
  const dirResult = directionConsistencyScore(directions);
  const bounce = bounceBackScore(scores);

  const actualDays = windowData.length;
  const expected = expectedDays ?? windowDays;
  const missingDaysInWindow = Math.max(0, expected - actualDays);
  const missingRatio = expected > 0 ? missingDaysInWindow / expected : 0;

  const hrvCrashDays = windowData.filter((d) => d.hrvCrash).length;

  const latencyValues = windowData
    .map((d) => d.metrics.onsetLatencyMinutes)
    .filter(Number.isFinite);
  const bedtimeValues = windowData
    .map((d) => d.metrics.bedtimeMinutes)
    .filter(Number.isFinite);
  const sleepValues = windowData
    .map((d) => d.metrics.totalSleepMinutes)
    .filter(Number.isFinite);
  const hrvValues = windowData
    .map((d) => d.metrics.avgHrv)
    .filter(Number.isFinite);

  const latencyCV =
    latencyValues.length > 1 ? coefficientOfVariation(latencyValues) : 0;
  const bedtimeCV =
    bedtimeValues.length > 1 ? circularVariation(bedtimeValues) : 0;
  const sleepDurationCV =
    sleepValues.length > 1 ? coefficientOfVariation(sleepValues) : 0;
  const hrvCV =
    hrvValues.length > 1 ? coefficientOfVariation(hrvValues) : 0;

  const priorLatencyCVs = consecutiveWindows(
    allPriorMetrics,
    windowDays,
    (result) => result.metrics.onsetLatencyMinutes
  ).map((values) => coefficientOfVariation(values));
  const baselineLatencyCV =
    priorLatencyCVs.length > 0 ? trimmedMean(priorLatencyCVs) : Number.NaN;
  const latencyCVStd =
    priorLatencyCVs.length > 1
      ? standardDeviation(priorLatencyCVs, baselineLatencyCV)
      : Number.NaN;
  const latCVZ = zScore(latencyCV, baselineLatencyCV, latencyCVStd);

  const priorBedtimeCVs = consecutiveWindows(
    allPriorMetrics,
    windowDays,
    (result) => result.metrics.bedtimeMinutes
  ).map((values) => circularVariation(values));
  const baselineBedtimeCV =
    priorBedtimeCVs.length > 0 ? trimmedMean(priorBedtimeCVs) : Number.NaN;
  const bedtimeCVStd =
    priorBedtimeCVs.length > 1
      ? standardDeviation(priorBedtimeCVs, baselineBedtimeCV)
      : Number.NaN;
  const bedtimeCVZ = zScore(bedtimeCV, baselineBedtimeCV, bedtimeCVStd);

  const temperatureByDay = new Map(
    windowData.map((result) => [
      result.day,
      result.metrics.temperatureDeviation,
    ])
  );
  const tempDeltas: number[] = [];
  for (
    let day = earliestDay;
    day <= latestDay;
    day = shiftCalendarDay(day, 1)
  ) {
    tempDeltas.push(temperatureByDay.get(day) ?? Number.NaN);
  }
  const tempResult = temperatureTrend(tempDeltas);

  const windowMultiplier = WINDOW_MULTIPLIERS[windowDays] ?? 1.0;
  let evidenceScore = consistency * 3.0;
  evidenceScore += Math.max(0, slope) * 2.0;
  evidenceScore += dirResult.ratio * 1.5;

  if (dirResult.dominant === "hypo" && latCVZ > 0) {
    evidenceScore += latCVZ * 1.0;
  }
  if (dirResult.dominant === "hyper" && tempResult.elevated) {
    evidenceScore += 2.0;
  }

  evidenceScore += hrvCrashDays * 1.5;

  if (bedtimeCVZ > 0) {
    evidenceScore += bedtimeCVZ * 0.8;
  }

  const withinNightVarValues = windowData
    .map((d) => d.zScores.withinNightVar ?? 0)
    .filter((v) => v !== 0);
  if (withinNightVarValues.length > 0) {
    const withinNightVarTrend = trendSlope(withinNightVarValues);
    if (withinNightVarTrend > 0) {
      evidenceScore += withinNightVarTrend * 1.5;
    }
  }

  const activityZScores = windowData
    .map((d) => d.zScores.activity ?? 0)
    .filter((v) => v !== 0);
  if (activityZScores.length > 0) {
    const avgActivityZ = activityZScores.reduce((s, v) => s + v, 0) / activityZScores.length;
    evidenceScore += Math.abs(avgActivityZ) * 1.0;
  }

  const circadianIVZScores = windowData
    .map((d) => d.zScores.circadianIV ?? 0)
    .filter((v) => v !== 0);
  if (circadianIVZScores.length > 0) {
    const avgCircadianIVZ = circadianIVZScores.reduce((s, v) => s + v, 0) / circadianIVZScores.length;
    if (avgCircadianIVZ > 0) {
      evidenceScore += avgCircadianIVZ * 1.0;
    }
  }

  const stressfulDays = windowData.filter((d) => d.metrics.stressHigh > 3600);
  if (stressfulDays.length >= 2) {
    evidenceScore += stressfulDays.length * 0.4;
  }

  const resilienceLevels = windowData
    .map((d) => d.metrics.resilienceLevel)
    .filter((l): l is string => l !== null);
  const lowResilience = resilienceLevels.filter((l) => l === "limited" || l === "adequate");
  if (lowResilience.length >= 2) {
    evidenceScore += lowResilience.length * 0.4;
  }

  const profile = getBipolarProfile(bipolarType);
  if (dirResult.dominant === "hypo") {
    evidenceScore *= (1.0 - bounce * profile.hypoBounceBackMultiplier);
  } else {
    evidenceScore *= (1.0 - bounce * profile.hyperBounceBackMultiplier);
  }
  evidenceScore *= windowMultiplier;
  evidenceScore *= Math.max(0, 1 - missingRatio);

  return {
    windowDays,
    trendSlope: slope,
    consistencyRatio: consistency,
    directionConsistency: dirResult.ratio,
    bounceBackScore: bounce,
    latencyCV,
    latencyCVZScore: latCVZ,
    bedtimeCV,
    bedtimeCVZScore: bedtimeCVZ,
    sleepDurationCV,
    hrvCV,
    temperatureMean: tempResult.mean,
    temperatureElevated: tempResult.elevated,
    missingDaysInWindow,
    hrvCrashDays,
    confidence: normalizeEvidenceScore(evidenceScore),
    direction: dirResult.dominant,
  };
}

export function analyzeAllWindows(
  dailyResults: DailyAnalysisResult[],
  allPriorResults: DailyAnalysisResult[],
  config: DetectionConfigValues,
  expectedDaysByWindow?: Record<number, number>,
  bipolarType: BipolarType = "unspecified"
): { best: WindowResult | null; all: WindowResult[] } {
  const windows: WindowResult[] = [];

  for (const size of [3, 5, 7]) {
    const expected = expectedDaysByWindow?.[size];
    const result = analyzeWindow(dailyResults, size, allPriorResults, config, expected, bipolarType);
    if (result) windows.push(result);
  }

  if (windows.length === 0) return { best: null, all: [] };

  const best = windows.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  return { best, all: windows };
}
