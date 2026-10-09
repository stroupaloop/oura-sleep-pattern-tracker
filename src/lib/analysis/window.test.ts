import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import type { DailyAnalysisResult, DayMetrics } from "./anomaly";
import {
  activationDirection,
  analyzeAllWindows,
  analyzeWindow,
  DIRECTION_LEAN,
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

  it("applies the BP1 higher-activation bounce-back profile while unspecified keeps the default", () => {
    const bouncedPattern = [
      { ...result("2026-07-01"), compositeScore: 2 },
      { ...result("2026-07-02"), compositeScore: 4 },
      { ...result("2026-07-03"), compositeScore: 2 },
    ];

    const bp1 = analyzeWindow(
      bouncedPattern,
      3,
      [],
      DEFAULT_CONFIG,
      3,
      "bp1"
    );
    const bp2 = analyzeWindow(
      bouncedPattern,
      3,
      [],
      DEFAULT_CONFIG,
      3,
      "bp2"
    );
    const unspecified = analyzeWindow(
      bouncedPattern,
      3,
      [],
      DEFAULT_CONFIG,
      3,
      "unspecified"
    );

    expect(bp1).not.toBeNull();
    expect(bp2).not.toBeNull();
    expect(unspecified).not.toBeNull();
    expect(bp1!.bounceBackScore).toBeGreaterThan(0);
    expect(bp1!.confidence).toBeGreaterThan(bp2!.confidence);
    expect(unspecified!.confidence).toBeCloseTo(bp2!.confidence, 10);
  });

  it("does not use self-reported episode labels as multi-day evidence", () => {
    const wearableOnly = [
      result("2026-07-01"),
      result("2026-07-02"),
      result("2026-07-03"),
    ];
    const withLabels = wearableOnly.map((entry, index) => ({
      ...entry,
      metrics: {
        ...entry.metrics,
        moodScore: 3,
        energyScore: 5,
        irritabilityScore: 5,
        episodeState: index === 2 ? "mixed" : "hypomanic",
      },
    }));

    const wearableWindow = analyzeWindow(
      wearableOnly,
      3,
      [],
      DEFAULT_CONFIG,
      3,
      "bp2"
    );
    const labelledWindow = analyzeWindow(
      withLabels,
      3,
      [],
      DEFAULT_CONFIG,
      3,
      "bp2"
    );

    expect(wearableWindow).not.toBeNull();
    expect(labelledWindow).not.toBeNull();
    expect(labelledWindow!.confidence).toBeCloseTo(
      wearableWindow!.confidence,
      10
    );
    expect(labelledWindow!.direction).toBe(wearableWindow!.direction);
  });
});

describe("variability against prior windows with a far-off one", () => {
  const night = (
    index: number,
    overrides: Partial<DayMetrics>,
    direction: DailyAnalysisResult["direction"] = "hyper"
  ): DailyAnalysisResult => {
    const day = new Date(Date.UTC(2000, 0, 1 + index)).toISOString().slice(0, 10);
    return { ...result(day), metrics: { ...metrics(day), ...overrides }, direction };
  };

  it("still scores unsettled sleep onsets after one far-off prior window", () => {
    const usual = [10, 14, 20, 12];
    const steady = Array.from({ length: 20 }, (_, index) =>
      night(index, { onsetLatencyMinutes: usual[index % usual.length] })
    );
    const farOff = [5, 60, 5].map((minutes, offset) =>
      night(22 + offset, { onsetLatencyMinutes: minutes })
    );
    const unsettled = [8, 25, 10].map((minutes, offset) =>
      night(30 + offset, { onsetLatencyMinutes: minutes }, "hypo")
    );

    const clean = analyzeWindow(unsettled, 3, steady, DEFAULT_CONFIG, 3);
    const withFarOff = analyzeWindow(unsettled, 3, [...steady, ...farOff], DEFAULT_CONFIG, 3);

    expect(withFarOff!.latencyCVZScore).toBeCloseTo(4.31, 2);
    expect(withFarOff!.confidence).toBeCloseTo(7.14, 2);
    expect(clean!.latencyCVZScore).toBeCloseTo(4.39, 2);
  });

  it("still scores scattered bedtimes after one far-off prior window", () => {
    const usual = [-30, 10, 30, -20];
    const steady = Array.from({ length: 20 }, (_, index) =>
      night(index, { bedtimeMinutes: usual[index % usual.length] })
    );
    const farOff = [-20, 240, -10].map((minutes, offset) =>
      night(22 + offset, { bedtimeMinutes: minutes })
    );
    const scattered = [-45, 30, -30].map((minutes, offset) =>
      night(30 + offset, { bedtimeMinutes: minutes })
    );

    const clean = analyzeWindow(scattered, 3, steady, DEFAULT_CONFIG, 3);
    const withFarOff = analyzeWindow(scattered, 3, [...steady, ...farOff], DEFAULT_CONFIG, 3);

    expect(withFarOff!.bedtimeCVZScore).toBeCloseTo(3.29, 2);
    expect(withFarOff!.confidence).toBeCloseTo(6.78, 2);
    expect(clean!.bedtimeCVZScore).toBeCloseTo(3.37, 2);
  });
});

describe("evidence that is not about sleep, timing or activity", () => {
  const days = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"];
  const withTemperature = (temperature: number) =>
    days.map((day) => {
      const base = result(day);
      return {
        ...base,
        metrics: {
          ...base.metrics,
          temperatureDeviation: temperature,
          temperatureDelta: temperature,
        },
      };
    });

  it("does not add evidence for warm nights, though it still notes them", () => {
    const warm = analyzeWindow(withTemperature(0.8), 5, [], DEFAULT_CONFIG, 5);
    const cool = analyzeWindow(withTemperature(0), 5, [], DEFAULT_CONFIG, 5);

    expect(warm!.temperatureElevated).toBe(true);
    expect(cool!.temperatureElevated).toBe(false);
    expect(warm!.confidence).toBeCloseTo(cool!.confidence, 10);
  });
});

describe("direction from the signed activation score", () => {
  it("leans toward the side most nights sit on", () => {
    const hyper = activationDirection([1.2, 0.9, 1.4]);
    expect(hyper.dominant).toBe("hyper");
    expect(hyper.ratio).toBe(1);
    expect(hyper.mean).toBeCloseTo(1.17, 2);

    const hypo = activationDirection([-1.1, -0.8, -1.3, -0.2]);
    expect(hypo.dominant).toBe("hypo");
    expect(hypo.ratio).toBe(0.75);
  });

  it("calls a window mixed when opposite nights cancel", () => {
    expect(activationDirection([1.5, -1.5, 1.5, -1.5])).toMatchObject({
      dominant: null,
      ratio: 0,
    });
  });

  it("needs a lean of more than half a standard deviation", () => {
    const edge = activationDirection([DIRECTION_LEAN, DIRECTION_LEAN, DIRECTION_LEAN]);
    expect(edge.dominant).toBeNull();
    const just = activationDirection([0.6, 0.6, 0.6]);
    expect(just.dominant).toBe("hyper");
  });

  it("gives little weight to one extreme night among quiet ones", () => {
    const lone = activationDirection([2.4, 0.1, 0.1, 0.1]);
    expect(lone.dominant).toBe("hyper");
    expect(lone.ratio).toBe(0.25);
  });

  it("says nothing with no scored nights", () => {
    expect(activationDirection([])).toMatchObject({ dominant: null, ratio: 0 });
  });

  it("reads a window's direction from the nights' scores, not their single-night labels", () => {
    const nights = ["2026-07-01", "2026-07-02", "2026-07-03"].map((day) => ({
      ...result(day),
      direction: "hyper" as const,
      activation: -0.9,
    }));
    expect(analyzeWindow(nights, 3, [], DEFAULT_CONFIG, 3)!.direction).toBe("hypo");
  });

  it("falls back to the single-night labels for nights stored without a score", () => {
    const nights = ["2026-07-01", "2026-07-02", "2026-07-03"].map(result);
    expect(analyzeWindow(nights, 3, [], DEFAULT_CONFIG, 3)!.direction).toBe("hyper");
  });
});

describe("the two-week view", () => {
  const fortnight = (activation: number, score = 1.6) =>
    Array.from({ length: 14 }, (_, index) => {
      const day = new Date(Date.UTC(2026, 6, 1 + index)).toISOString().slice(0, 10);
      return { ...result(day), compositeScore: score, activation };
    });

  it("is read when the fortnight leans toward lower activation", () => {
    const { lowerView, best } = analyzeAllWindows(fortnight(-1), [], DEFAULT_CONFIG);
    expect(best).not.toBeNull();
    expect(lowerView?.windowDays).toBe(14);
    expect(lowerView?.direction).toBe("hypo");
  });

  it("is left out when the fortnight leans toward higher activation", () => {
    expect(analyzeAllWindows(fortnight(1), [], DEFAULT_CONFIG).lowerView).toBeNull();
  });

  it("is left out when the fortnight has no clear lean", () => {
    expect(analyzeAllWindows(fortnight(0.1), [], DEFAULT_CONFIG).lowerView).toBeNull();
  });
});
