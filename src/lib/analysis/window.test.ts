import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import type { DailyAnalysisResult, DayMetrics } from "./anomaly";
import {
  analyzeWindow,
  normalizeEvidenceScore,
  temperatureTrend,
} from "./window";

function metrics(day: string): DayMetrics {
  return {
    day,
    totalSleepMinutes: 420,
    bedtimeMinutes: -30,
    wakeTimeMinutes: 450,
    avgHrv: 50,
    avgHeartRate: 55,
    onsetLatencyMinutes: 15,
    remPct: 22,
    deepPct: 18,
    efficiency: 88,
    temperatureDelta: 0.6,
    restlessPeriods: 10,
    withinNightHrvCV: 0.1,
    withinNightHrCV: 0.1,
    sleepStageTransitions: 20,
    hypnogramFragmentation: 0.2,
    lowestHeartRate: 48,
    averageBreath: 14,
    steps: 8_000,
    activeMinutes: 45,
    activityClassFragmentation: 0.5,
    stressHigh: 4_000,
    recoveryHigh: 2_000,
    resilienceLevel: "adequate",
    sleepTimingScore: 80,
    readinessScore: 80,
    temperatureDeviation: 0.6,
    temperatureTrendDeviation: 0.2,
    dayToDaySleepCV: 0.1,
    dayToDayBedtimeCV: 0.01,
    dayToDayWakeCV: 0.01,
    circadianIS: 0.8,
    circadianIV: 0.7,
    circadianRA: 0.7,
    moodScore: null,
    energyScore: null,
    irritabilityScore: null,
    anxietyScore: null,
    averageSpo2: null,
    breathingDisturbanceIndex: null,
    episodeState: null,
  };
}

function result(day: string): DailyAnalysisResult {
  return {
    day,
    metrics: metrics(day),
    baselines: {},
    zScores: {
      withinNightVar: 1,
      activity: 1,
      circadianIV: 1,
    },
    compositeScore: 2,
    isAnomaly: true,
    direction: "hyper",
    notes: "",
    hrvCrash: false,
  };
}

describe("window analysis coverage", () => {
  it("reduces evidence when a calendar day is missing", () => {
    const complete = analyzeWindow(
      [result("2026-07-01"), result("2026-07-02"), result("2026-07-03")],
      3,
      [],
      DEFAULT_CONFIG,
      3
    );
    const missing = analyzeWindow(
      [result("2026-07-01"), result("2026-07-03")],
      3,
      [],
      DEFAULT_CONFIG,
      3
    );

    expect(complete).not.toBeNull();
    expect(missing).not.toBeNull();
    expect(missing!.missingDaysInWindow).toBe(1);
    expect(missing!.confidence).toBeLessThan(complete!.confidence);
  });

  it("does not count temperature readings across a missing day as consecutive", () => {
    const result = temperatureTrend([0.6, Number.NaN, 0.7, 0.8]);
    expect(result.mean).toBeCloseTo(0.7, 6);
    expect(result.elevated).toBe(false);
  });

  it("keeps the displayed evidence score on its 0–10 scale", () => {
    expect(normalizeEvidenceScore(12.4)).toBe(10);
    expect(normalizeEvidenceScore(-1)).toBe(0);
    expect(normalizeEvidenceScore(Number.NaN)).toBe(0);
  });
});
