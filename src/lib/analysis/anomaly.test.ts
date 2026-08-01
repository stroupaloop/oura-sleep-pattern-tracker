import { describe, expect, it } from "vitest";
import { computeDailyAnalysis, type DayMetrics } from "./anomaly";
import { DEFAULT_CONFIG } from "./config";

function dayMetrics(day: string, temperatureDeviation: number): DayMetrics {
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
    temperatureDelta: Number.NaN,
    restlessPeriods: 10,
    withinNightHrvCV: Number.NaN,
    withinNightHrCV: Number.NaN,
    sleepStageTransitions: Number.NaN,
    hypnogramFragmentation: Number.NaN,
    lowestHeartRate: 48,
    averageBreath: 14,
    steps: Number.NaN,
    activeMinutes: Number.NaN,
    activityClassFragmentation: Number.NaN,
    stressHigh: Number.NaN,
    recoveryHigh: Number.NaN,
    resilienceLevel: null,
    sleepTimingScore: Number.NaN,
    readinessScore: 80,
    temperatureDeviation,
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

describe("daily analysis source and missingness", () => {
  const prior = Array.from({ length: 14 }, (_, index) =>
    dayMetrics(
      `2026-07-${String(index + 1).padStart(2, "0")}`,
      index % 2 === 0 ? -0.1 : 0.1
    )
  );

  it("uses Daily Readiness temperature deviation", () => {
    const result = computeDailyAnalysis(
      dayMetrics("2026-07-15", 0.8),
      prior,
      DEFAULT_CONFIG
    );
    expect(result).not.toBeNull();
    expect(result!.zScores.temperature).toBeGreaterThan(2);
  });

  it("does not turn unavailable physiology into threshold evidence", () => {
    const current = dayMetrics("2026-07-15", Number.NaN);
    current.avgHrv = Number.NaN;
    current.avgHeartRate = Number.NaN;
    current.efficiency = Number.NaN;

    const result = computeDailyAnalysis(current, prior, DEFAULT_CONFIG);
    expect(result).not.toBeNull();
    expect(result!.zScores.hrv).toBe(0);
    expect(result!.zScores.hr).toBe(0);
    expect(result!.zScores.temperature).toBe(0);
    expect(result!.compositeScore).toBe(0);
  });

  it("classifies reduced sleep and earlier timing as higher activation", () => {
    const variablePrior = prior.map((metric, index) => ({
      ...metric,
      totalSleepMinutes: 390 + (index % 5) * 15,
      bedtimeMinutes: -60 + (index % 5) * 15,
      wakeTimeMinutes: 420 + (index % 5) * 15,
    }));
    const current = {
      ...dayMetrics("2026-07-15", 0),
      totalSleepMinutes: 240,
      bedtimeMinutes: -150,
      wakeTimeMinutes: 300,
    };

    const result = computeDailyAnalysis(
      current,
      variablePrior,
      DEFAULT_CONFIG
    );
    expect(result?.isAnomaly).toBe(true);
    expect(result?.direction).toBe("hyper");
  });

  it("does not assign episode direction from nonspecific physiology alone", () => {
    const variablePrior = prior.map((metric, index) => ({
      ...metric,
      avgHrv: 45 + (index % 5) * 2,
      avgHeartRate: 52 + (index % 5),
      efficiency: 84 + (index % 5),
    }));
    const current = {
      ...dayMetrics("2026-07-15", 0),
      avgHrv: 10,
      avgHeartRate: 90,
      efficiency: 60,
    };

    const result = computeDailyAnalysis(
      current,
      variablePrior,
      DEFAULT_CONFIG
    );
    expect(result?.isAnomaly).toBe(true);
    expect(result?.direction).toBeNull();
  });

  it("uses personal baselines instead of universal heart-rate or HRV cutoffs", () => {
    const personallyTypicalPrior = prior.map((metric, index) => ({
      ...metric,
      avgHeartRate: 88 + (index % 5),
      avgHrv: 15 + (index % 5),
    }));
    const current = {
      ...dayMetrics("2026-07-15", 0),
      avgHeartRate: 90,
      avgHrv: 17,
    };

    const result = computeDailyAnalysis(
      current,
      personallyTypicalPrior,
      DEFAULT_CONFIG
    );
    expect(result?.compositeScore).toBeLessThan(0.5);
    expect(result?.isAnomaly).toBe(false);
  });
});
