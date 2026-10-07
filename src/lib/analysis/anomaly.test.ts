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
      onsetLatencyMinutes: 12 + (index % 4) * 2,
      restlessPeriods: 8 + (index % 3) * 2,
      deepPct: 16 + (index % 3),
      remPct: 20 + (index % 4),
      temperatureDeviation: (index % 4) * 0.1,
    }));
    const current = {
      ...dayMetrics("2026-07-15", 3),
      avgHrv: 10,
      avgHeartRate: 90,
      efficiency: 60,
      onsetLatencyMinutes: 120,
      restlessPeriods: 60,
      deepPct: 2,
      remPct: 3,
    };

    const result = computeDailyAnalysis(
      current,
      variablePrior,
      DEFAULT_CONFIG
    );
    expect(result?.isAnomaly).toBe(true);
    expect(result?.direction).toBeNull();
  });

  it("keeps one extreme measure from flagging a night by itself", () => {
    const variablePrior = prior.map((metric, index) => ({
      ...metric,
      avgHeartRate: 52 + (index % 5),
    }));
    const current = { ...dayMetrics("2026-07-15", 0), avgHeartRate: 200 };

    const result = computeDailyAnalysis(current, variablePrior, DEFAULT_CONFIG);
    expect(result!.zScores.hr).toBeGreaterThan(20);
    expect(result!.compositeScore).toBeLessThan(0.3);
    expect(result!.isAnomaly).toBe(false);
  });

  it("flags a night on sleep alone 0.5 past the configured daily threshold", () => {
    const variablePrior = prior.map((metric, index) => ({
      ...metric,
      totalSleepMinutes: 380 + (index % 5) * 20,
    }));
    const probe = computeDailyAnalysis(
      { ...dayMetrics("2026-07-15", 0), totalSleepMinutes: 300 },
      variablePrior,
      DEFAULT_CONFIG
    )!;
    const spread = (probe.baselines.sleep - 300) / Math.abs(probe.zScores.sleep);
    const night = {
      ...dayMetrics("2026-07-15", 0),
      totalSleepMinutes: probe.baselines.sleep - 1.85 * spread,
    };

    const usual = computeDailyAnalysis(night, variablePrior, DEFAULT_CONFIG);
    expect(usual!.zScores.sleep).toBeCloseTo(-1.85, 5);
    expect(usual!.isAnomaly).toBe(false);

    const sensitive = computeDailyAnalysis(night, variablePrior, {
      ...DEFAULT_CONFIG,
      dailyAnomalyThreshold: 1.2,
    });
    expect(sensitive!.isAnomaly).toBe(true);
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

  it("applies the documented BP2 daily weight overrides while unspecified keeps base weights", () => {
    const variablePrior = prior.map((metric, index) => ({
      ...metric,
      totalSleepMinutes: 390 + (index % 5) * 15,
      withinNightHrvCV: 0.08 + (index % 5) * 0.01,
      withinNightHrCV: 0.07 + (index % 5) * 0.01,
      hypnogramFragmentation: 0.12 + (index % 5) * 0.01,
    }));
    const current = {
      ...dayMetrics("2026-07-15", 0),
      totalSleepMinutes: 375,
      withinNightHrvCV: 0.25,
      withinNightHrCV: 0.22,
      hypnogramFragmentation: 0.30,
    };

    const bp1 = computeDailyAnalysis(current, variablePrior, DEFAULT_CONFIG, "bp1");
    const bp2 = computeDailyAnalysis(current, variablePrior, DEFAULT_CONFIG, "bp2");
    const unspecified = computeDailyAnalysis(
      current,
      variablePrior,
      DEFAULT_CONFIG,
      "unspecified"
    );

    expect(bp1).not.toBeNull();
    expect(bp2).not.toBeNull();
    expect(unspecified).not.toBeNull();
    expect(unspecified!.compositeScore).toBeCloseTo(
      bp1!.compositeScore,
      10
    );
    expect(bp2!.compositeScore).toBeGreaterThan(bp1!.compositeScore);
  });

  it("keeps self-report context independent from the persisted pattern score", () => {
    const variablePrior = prior.map((metric, index) => ({
      ...metric,
      totalSleepMinutes: 390 + (index % 5) * 15,
      bedtimeMinutes: -60 + (index % 5) * 15,
      wakeTimeMinutes: 420 + (index % 5) * 15,
      moodScore: (index % 5) - 2,
      energyScore: (index % 5) + 1,
      irritabilityScore: (index % 5) + 1,
    }));
    const wearableMetrics = {
      ...dayMetrics("2026-07-15", 0),
      totalSleepMinutes: 240,
      bedtimeMinutes: -150,
      wakeTimeMinutes: 300,
    };
    const withSelfReport = {
      ...wearableMetrics,
      moodScore: 3,
      energyScore: 5,
      irritabilityScore: 5,
      anxietyScore: 5,
      episodeState: "hypomanic",
    };

    const wearableOnly = computeDailyAnalysis(
      wearableMetrics,
      variablePrior,
      DEFAULT_CONFIG,
      "bp2"
    );
    const contextualized = computeDailyAnalysis(
      withSelfReport,
      variablePrior,
      DEFAULT_CONFIG,
      "bp2"
    );

    expect(wearableOnly).not.toBeNull();
    expect(contextualized).not.toBeNull();
    expect(contextualized!.compositeScore).toBeCloseTo(
      wearableOnly!.compositeScore,
      10
    );
    expect(contextualized!.isAnomaly).toBe(wearableOnly!.isAnomaly);
    expect(contextualized!.direction).toBe(wearableOnly!.direction);
  });
});

describe("baseline spread with a far-off night", () => {
  const night = (index: number, totalSleepMinutes: number): DayMetrics => ({
    ...dayMetrics(`2000-01-${String(index + 1).padStart(2, "0")}`, 0),
    totalSleepMinutes,
  });
  const steady = Array.from({ length: 20 }, (_, index) =>
    night(index, index % 2 === 0 ? 400 : 440)
  );
  const shortNight = night(21, 360);

  it("flags a short night against a steady baseline", () => {
    const result = computeDailyAnalysis(shortNight, steady, DEFAULT_CONFIG);
    expect(result?.zScores.sleep).toBeCloseTo(-2.88, 2);
    expect(result?.isAnomaly).toBe(true);
  });

  it("still flags it after one long recovery night joins the baseline", () => {
    const withRecovery = [...steady, night(20, 600)];
    const result = computeDailyAnalysis(shortNight, withRecovery, DEFAULT_CONFIG);
    expect(result?.zScores.sleep).toBeCloseTo(-2.94, 2);
    expect(result?.isAnomaly).toBe(true);
  });
});
