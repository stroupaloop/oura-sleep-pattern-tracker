import { describe, expect, it } from "vitest";
import type { DailyAnalysisResult, DayMetrics } from "./anomaly";
import { DEFAULT_CONFIG } from "./config";
import { assessEpisode } from "./episode";

function metrics(day: string): DayMetrics {
  return {
    day,
    totalSleepMinutes: 330,
    bedtimeMinutes: -30,
    wakeTimeMinutes: 360,
    avgHrv: 56,
    avgHeartRate: 55,
    onsetLatencyMinutes: 15,
    remPct: 22,
    deepPct: 18,
    efficiency: 88,
    temperatureDelta: 0,
    restlessPeriods: 10,
    withinNightHrvCV: Number.NaN,
    withinNightHrCV: Number.NaN,
    sleepStageTransitions: Number.NaN,
    hypnogramFragmentation: Number.NaN,
    lowestHeartRate: 48,
    averageBreath: 14,
    steps: 8_000,
    activeMinutes: 45,
    activityClassFragmentation: Number.NaN,
    stressHigh: Number.NaN,
    recoveryHigh: Number.NaN,
    resilienceLevel: null,
    sleepTimingScore: Number.NaN,
    readinessScore: 80,
    temperatureDeviation: 0,
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

function flaggedNight(day: string): DailyAnalysisResult {
  return {
    day,
    metrics: metrics(day),
    baselines: { sleep: 420, hrv: 50, hr: 55 },
    zScores: {
      sleep: -1.7,
      hrv: 1.2,
      hr: 0,
      bedtime: 0,
      temperature: 0,
      efficiency: 0,
      latency: 0,
      withinNightVar: 0,
      activity: 0,
      circadianIV: 0,
      deepPct: 0,
      remPct: 0,
    },
    compositeScore: 2,
    isAnomaly: true,
    direction: "hyper",
    notes: "",
  };
}

const NIGHTS = ["2026-07-01", "2026-07-02", "2026-07-03"].map(flaggedNight);
const EXPECTED = { 3: 3, 5: 5, 7: 7 };

describe("assessEpisode text follows the configured thresholds", () => {
  it("names a driver once it passes the daily threshold, whichever that is", () => {
    const usual = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      DEFAULT_CONFIG,
      EXPECTED
    );
    expect(usual.tier).not.toBe("none");
    expect(usual.primaryDrivers.join(" ")).toMatch(/Sleep duration reduced/);

    const calm = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      { ...DEFAULT_CONFIG, dailyAnomalyThreshold: 2 },
      EXPECTED
    );
    expect(calm.primaryDrivers.join(" ")).not.toMatch(/Sleep duration/);
  });

  it("lists what was detected from the concern threshold", () => {
    const usual = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      DEFAULT_CONFIG,
      EXPECTED
    );
    expect(usual.researchContext?.whatWeDetected.join(" ")).toMatch(/HRV/);

    const stricter = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      { ...DEFAULT_CONFIG, concernThreshold: 1.3 },
      EXPECTED
    );
    expect(stricter.researchContext?.whatWeDetected.join(" ")).not.toMatch(
      /HRV/
    );
  });

  it("labels evidence by the configured tier cut-offs", () => {
    const strict = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      { ...DEFAULT_CONFIG, watchMinConfidence: 2.5, alertMinConfidence: 9 },
      EXPECTED
    );
    expect(strict.researchContext?.confidence ?? "low").not.toBe("high");
  });
});
