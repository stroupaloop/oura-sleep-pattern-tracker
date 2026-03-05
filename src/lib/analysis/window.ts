import { coefficientOfVariation, zScore, standardDeviation, trimmedMean } from "./baseline";
import { DetectionConfigValues } from "./config";
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
  if (tempDeltas.length === 0) return { mean: 0, elevated: false };
  const mean = tempDeltas.reduce((s, v) => s + v, 0) / tempDeltas.length;
  let consecutiveElevated = 0;
  let maxConsecutive = 0;
  for (const t of tempDeltas) {
    if (t > 0.5) {
      consecutiveElevated++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveElevated);
    } else {
      consecutiveElevated = 0;
    }
  }
  return { mean, elevated: maxConsecutive >= 3 };
}

const WINDOW_MULTIPLIERS: Record<number, number> = { 3: 0.6, 5: 0.85, 7: 1.0 };

export function analyzeWindow(
  dailyResults: DailyAnalysisResult[],
  windowDays: number,
  allPriorMetrics: DailyAnalysisResult[],
  config: DetectionConfigValues,
  expectedDays?: number
): WindowResult | null {
  if (dailyResults.length < Math.min(windowDays, 2)) return null;

  const windowData = dailyResults.slice(-windowDays);
  const scores = windowData.map((d) => d.compositeScore);
  const directions = windowData.map((d) => d.direction);

  const slope = trendSlope(scores);
  const consistency = consistencyRatio(scores, config.concernThreshold);
  const dirResult = directionConsistencyScore(directions);
  const bounce = bounceBackScore(scores);

  const actualDays = windowData.length;
  const expected = expectedDays ?? windowDays;
  const missingDaysInWindow = expected - actualDays;
  const missingRatio = expected > 0 ? missingDaysInWindow / expected : 0;

  const hrvCrashDays = windowData.filter((d) => d.hrvCrash).length;

  const latencyValues = windowData.map((d) => d.metrics.onsetLatencyMinutes);
  const bedtimeValues = windowData.map((d) => d.metrics.bedtimeMinutes);
  const sleepValues = windowData.map((d) => d.metrics.totalSleepMinutes);
  const hrvValues = windowData.map((d) => d.metrics.avgHrv).filter((v) => v > 0);

  const latencyCV = coefficientOfVariation(latencyValues);
  const bedtimeCV = coefficientOfVariation(bedtimeValues);
  const sleepDurationCV = coefficientOfVariation(sleepValues);
  const hrvCV = hrvValues.length > 1 ? coefficientOfVariation(hrvValues) : 0;

  const priorLatencyValues = allPriorMetrics.map((d) => d.metrics.onsetLatencyMinutes);
  const priorLatencyCVs: number[] = [];
  for (let i = windowDays; i <= priorLatencyValues.length; i++) {
    const slice = priorLatencyValues.slice(i - windowDays, i);
    priorLatencyCVs.push(coefficientOfVariation(slice));
  }
  const baselineLatencyCV = priorLatencyCVs.length > 0 ? trimmedMean(priorLatencyCVs) : 0;
  const latencyCVStd = priorLatencyCVs.length > 1 ? standardDeviation(priorLatencyCVs, baselineLatencyCV) : 0;
  const latCVZ = zScore(latencyCV, baselineLatencyCV, latencyCVStd);

  const priorBedtimeValues = allPriorMetrics.map((d) => d.metrics.bedtimeMinutes);
  const priorBedtimeCVs: number[] = [];
  for (let i = windowDays; i <= priorBedtimeValues.length; i++) {
    const slice = priorBedtimeValues.slice(i - windowDays, i);
    priorBedtimeCVs.push(coefficientOfVariation(slice));
  }
  const baselineBedtimeCV = priorBedtimeCVs.length > 0 ? trimmedMean(priorBedtimeCVs) : 0;
  const bedtimeCVStd = priorBedtimeCVs.length > 1 ? standardDeviation(priorBedtimeCVs, baselineBedtimeCV) : 0;
  const bedtimeCVZ = zScore(bedtimeCV, baselineBedtimeCV, bedtimeCVStd);

  const tempDeltas = windowData.map((d) => d.metrics.temperatureDelta);
  const tempResult = temperatureTrend(tempDeltas);

  const windowMultiplier = WINDOW_MULTIPLIERS[windowDays] ?? 1.0;
  let confidence = consistency * 3.0;
  confidence += Math.max(0, slope) * 2.0;
  confidence += dirResult.ratio * 1.5;

  if (dirResult.dominant === "hypo" && latCVZ > 0) {
    confidence += latCVZ * 1.0;
  }
  if (dirResult.dominant === "hyper" && tempResult.elevated) {
    confidence += 2.0;
  }

  if (missingRatio > 0.2) {
    confidence += missingRatio * 1.5;
  }

  confidence += hrvCrashDays * 1.5;

  if (bedtimeCVZ > 0) {
    confidence += bedtimeCVZ * 0.8;
  }

  if (dirResult.dominant === "hypo") {
    confidence *= (1.0 - bounce * 0.35);
  } else {
    confidence *= (1.0 - bounce * 0.7);
  }
  confidence *= windowMultiplier;

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
    confidence,
    direction: dirResult.dominant,
  };
}

export function analyzeAllWindows(
  dailyResults: DailyAnalysisResult[],
  allPriorResults: DailyAnalysisResult[],
  config: DetectionConfigValues,
  expectedDaysByWindow?: Record<number, number>
): { best: WindowResult | null; all: WindowResult[] } {
  const windows: WindowResult[] = [];

  for (const size of [3, 5, 7]) {
    const expected = expectedDaysByWindow?.[size];
    const result = analyzeWindow(dailyResults, size, allPriorResults, config, expected);
    if (result) windows.push(result);
  }

  if (windows.length === 0) return { best: null, all: [] };

  const best = windows.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  return { best, all: windows };
}
