import { describe, expect, it } from "vitest";
import type { DayMetrics } from "./anomaly";
import { DEFAULT_CONFIG } from "./config";
import { scoreHistory } from "./score-history";

function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** A steady wobble around the middle, offset per measure so they do not move together. */
function wob(index: number, cycle: number, offset = 0): number {
  return ((index + offset) % cycle) - (cycle - 1) / 2;
}

function night(index: number, overrides: Partial<DayMetrics> = {}): DayMetrics {
  return {
    day: shiftDay("2026-01-01", index),
    totalSleepMinutes: 420 + wob(index, 5) * 14,
    bedtimeMinutes: -40 + wob(index, 7) * 8,
    wakeTimeMinutes: 440 + wob(index, 3) * 8,
    avgHrv: 50 + wob(index, 4) * 3,
    avgHeartRate: 56 + wob(index, 6) * 1,
    onsetLatencyMinutes: 12 + wob(index, 5, 2) * 3,
    remPct: 22 + wob(index, 3, 1),
    deepPct: 16 + wob(index, 4, 2),
    efficiency: 90 + wob(index, 7, 3),
    temperatureDelta: Number.NaN,
    restlessPeriods: 150 + wob(index, 3, 1) * 10,
    withinNightHrvCV: Number.NaN,
    withinNightHrCV: Number.NaN,
    sleepStageTransitions: Number.NaN,
    hypnogramFragmentation: Number.NaN,
    lowestHeartRate: 50,
    averageBreath: 14.5,
    steps: 8000 + wob(index, 5, 1) * 600,
    activeMinutes: 40 + wob(index, 6) * 4,
    activityClassFragmentation: Number.NaN,
    stressHigh: Number.NaN,
    recoveryHigh: Number.NaN,
    resilienceLevel: null,
    sleepTimingScore: Number.NaN,
    readinessScore: 80,
    temperatureDeviation: wob(index, 5, 4) * 0.08,
    temperatureTrendDeviation: Number.NaN,
    dayToDaySleepCV: Number.NaN,
    dayToDayBedtimeCV: Number.NaN,
    dayToDayWakeCV: Number.NaN,
    circadianIS: Number.NaN,
    circadianIV: 0.8 + wob(index, 7, 2) * 0.03,
    circadianRA: Number.NaN,
    moodScore: null,
    energyScore: null,
    irritabilityScore: null,
    anxietyScore: null,
    averageSpo2: null,
    breathingDisturbanceIndex: null,
    episodeState: null,
    ...overrides,
  };
}

function history(count: number, change?: (index: number) => Partial<DayMetrics>) {
  return new Map(
    Array.from({ length: count }, (_, index) => {
      const metrics = night(index, change?.(index));
      return [metrics.day, metrics] as const;
    })
  );
}

describe("scoreHistory", () => {
  it("scores a night only once the baseline has enough earlier nights", () => {
    const { daily } = scoreHistory(history(20), DEFAULT_CONFIG, "unspecified");
    const days = [...daily.keys()].sort();
    expect(days).toHaveLength(20 - DEFAULT_CONFIG.minBaselineDays);
    expect(days[0]).toBe(shiftDay("2026-01-01", DEFAULT_CONFIG.minBaselineDays));
  });

  it("assesses only the days asked for, from results for every scored night", () => {
    const wanted = [shiftDay("2026-01-01", 38), shiftDay("2026-01-01", 39)];
    const { daily, assessments } = scoreHistory(
      history(40),
      DEFAULT_CONFIG,
      "unspecified",
      wanted
    );
    expect(daily.size).toBe(40 - DEFAULT_CONFIG.minBaselineDays);
    expect([...assessments.keys()].sort()).toEqual(wanted);
  });

  it("never lets a later night change an earlier result", () => {
    const base = scoreHistory(history(45), DEFAULT_CONFIG, "bp2");
    const extended = scoreHistory(
      history(60, (index) =>
        index >= 45 ? { totalSleepMinutes: 150, steps: 22_000 } : {}
      ),
      DEFAULT_CONFIG,
      "bp2"
    );
    for (const [day, result] of base.daily) {
      expect(extended.daily.get(day)?.compositeScore).toBe(result.compositeScore);
      expect(extended.assessments.get(day)?.tier).toBe(
        base.assessments.get(day)?.tier
      );
      expect(extended.assessments.get(day)?.confidence).toBe(
        base.assessments.get(day)?.confidence
      );
    }
  });

  it("flags a run of much shorter, busier nights as higher activation", () => {
    const { assessments } = scoreHistory(
      history(50, (index) =>
        index >= 43
          ? { totalSleepMinutes: 240, bedtimeMinutes: 60, steps: 14_000, activeMinutes: 90 }
          : {}
      ),
      DEFAULT_CONFIG,
      "bp2"
    );
    const last = assessments.get(shiftDay("2026-01-01", 49));
    expect(last?.tier).not.toBe("none");
    expect(last?.direction).toBe("hyper");
  });

  it("does not flag an ordinary stretch", () => {
    const { assessments } = scoreHistory(history(60), DEFAULT_CONFIG, "bp2");
    expect([...assessments.values()].every((a) => a.tier === "none")).toBe(true);
  });
});
