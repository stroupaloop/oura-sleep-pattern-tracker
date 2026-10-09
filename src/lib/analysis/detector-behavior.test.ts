import { describe, expect, it, vi } from "vitest";
import type { DayMetrics } from "./anomaly";
import { DEFAULT_CONFIG } from "./config";
import { scoreHistory, type ScoredHistory } from "./score-history";

/**
 * How the detector behaves on simulated years, not on one hand-built case.
 * People are synthetic: nightly values wander around typical figures with
 * some carry-over from night to night and a weekend effect, and an episode is
 * an effect added from a chosen night. The bounds sit well inside what the
 * detector does today, so they fail on a real loss of behavior and not on
 * noise, and the seeds are fixed so a run is repeatable.
 */

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(next: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = next();
  while (v === 0) v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function dayAt(index: number): string {
  const date = new Date("2026-01-01T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}

function clock(minutes: number): number {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return wrapped > 720 ? wrapped - 1440 : wrapped;
}

interface Effect {
  sleepMinutes?: number;
  bedtimeMinutes?: number;
  stepsFactor?: number;
  hrvFactor?: number;
  heartRate?: number;
}

type EffectAt = (index: number) => Effect | null;

/** Ramp in over `ramp` nights, hold, ramp out over `down`. */
function episode(
  onset: number,
  ramp: number,
  hold: number,
  down: number,
  full: Effect
): EffectAt {
  return (index) => {
    const t = index - onset;
    if (t < 0) return null;
    let weight: number;
    if (t < ramp) weight = (t + 1) / ramp;
    else if (t < ramp + hold) weight = 1;
    else if (t < ramp + hold + down) weight = 1 - (t - ramp - hold + 1) / (down + 1);
    else return null;
    const scaleSum = (value: number | undefined) => (value ?? 0) * weight;
    const scaleFactor = (value: number | undefined) => 1 + ((value ?? 1) - 1) * weight;
    return {
      sleepMinutes: scaleSum(full.sleepMinutes),
      bedtimeMinutes: scaleSum(full.bedtimeMinutes),
      stepsFactor: scaleFactor(full.stepsFactor),
      hrvFactor: scaleFactor(full.hrvFactor),
      heartRate: scaleSum(full.heartRate),
    };
  };
}

function simulate(days: number, seed: number, effectAt?: EffectAt): Map<string, DayMetrics> {
  const next = random(seed);
  const carry = (previous: number, keep: number) =>
    keep * previous + Math.sqrt(1 - keep * keep) * gaussian(next);
  let sleepNoise = 0;
  let bedNoise = 0;
  let recovery = 0;
  let stepsNoise = 0;
  const nights = new Map<string, DayMetrics>();

  for (let index = 0; index < days; index++) {
    sleepNoise = carry(sleepNoise, 0.25);
    bedNoise = carry(bedNoise, 0.3);
    recovery = carry(recovery, 0.5);
    stepsNoise = carry(stepsNoise, 0.2);
    const weekend = index % 7 === 4 || index % 7 === 5 ? 1 : 0;
    const effect = effectAt?.(index) ?? {};

    const sleep = Math.max(
      90,
      420 + 20 * weekend + 45 * sleepNoise + (effect.sleepMinutes ?? 0)
    );
    const bedtime = -40 + 35 * weekend + 38 * bedNoise + (effect.bedtimeMinutes ?? 0);
    const wake = bedtime + sleep + 38 + 10 * gaussian(next);
    const hrvNoise = 0.6 * recovery + 0.8 * gaussian(next);
    const latency = Math.max(1, 11 * Math.exp(0.5 * gaussian(next)));
    const steps = Math.max(
      300,
      (8200 + 2600 * stepsNoise + (weekend ? 400 : 0)) * (effect.stepsFactor ?? 1)
    );
    const day = dayAt(index);

    nights.set(day, {
      day,
      totalSleepMinutes: sleep,
      bedtimeMinutes: clock(bedtime),
      wakeTimeMinutes: clock(wake),
      avgHrv: Math.max(8, 55 * Math.exp(0.18 * hrvNoise) * (effect.hrvFactor ?? 1)),
      avgHeartRate:
        58 + 3 * (-0.5 * hrvNoise + 0.87 * gaussian(next)) + (effect.heartRate ?? 0),
      onsetLatencyMinutes: latency,
      remPct: 22 + 4 * gaussian(next),
      deepPct: 15 + 4 * gaussian(next),
      efficiency: Math.min(99, 90 + 3 * gaussian(next) - 0.03 * (latency - 11)),
      temperatureDelta: Number.NaN,
      restlessPeriods: Math.round(150 + 30 * gaussian(next)),
      withinNightHrvCV: 0.28 + 0.05 * gaussian(next),
      withinNightHrCV: 0.07 + 0.015 * gaussian(next),
      sleepStageTransitions: 40,
      hypnogramFragmentation: 0.21 + 0.025 * gaussian(next),
      lowestHeartRate: 50,
      averageBreath: 14.5,
      steps,
      activeMinutes: Math.max(0, 40 + 18 * gaussian(next)) * Math.min(1.8, steps / 8200),
      activityClassFragmentation: Number.NaN,
      stressHigh: Number.NaN,
      recoveryHigh: Number.NaN,
      resilienceLevel: null,
      sleepTimingScore: Number.NaN,
      readinessScore: 80,
      temperatureDeviation: 0.22 * gaussian(next),
      temperatureTrendDeviation: Number.NaN,
      dayToDaySleepCV: Number.NaN,
      dayToDayBedtimeCV: Number.NaN,
      dayToDayWakeCV: Number.NaN,
      circadianIS: 0.55 + 0.1 * gaussian(next),
      circadianIV: 0.85 + 0.12 * gaussian(next),
      circadianRA: 0.85,
      moodScore: null,
      energyScore: null,
      irritabilityScore: null,
      anxietyScore: null,
      averageSpo2: null,
      breathingDisturbanceIndex: null,
      episodeState: null,
    });
  }
  return nights;
}

const TIER_RANK: Record<string, number> = { none: 0, watch: 1, warning: 2, alert: 3 };

function peakTier(history: ScoredHistory, fromIndex: number, toIndex: number): number {
  let peak = 0;
  for (let index = fromIndex; index < toIndex; index++) {
    const tier = history.assessments.get(dayAt(index))?.tier;
    if (tier) peak = Math.max(peak, TIER_RANK[tier]);
  }
  return peak;
}

function flaggedOn(history: ScoredHistory, index: number): boolean {
  const tier = history.assessments.get(dayAt(index))?.tier;
  return tier !== undefined && TIER_RANK[tier] >= 1;
}

/** Separate runs of days at or above a tier. */
function runsAtLeast(history: ScoredHistory, rank: number, fromIndex: number, toIndex: number): number {
  let runs = 0;
  let inRun = false;
  for (let index = fromIndex; index < toIndex; index++) {
    const tier = history.assessments.get(dayAt(index))?.tier;
    const on = tier !== undefined && TIER_RANK[tier] >= rank;
    if (on && !inRun) runs++;
    inRun = on;
  }
  return runs;
}

// Each test scores several simulated years; a slow CI runner needs more than the 5 s default.
vi.setConfig({ testTimeout: 60_000 });

const SEEDS = Array.from({ length: 12 }, (_, index) => 9100 + index);
const STEADY_YEAR_PEOPLE = 6;
const ONSET = 150;

/** The nights from `from` up to, not including, `to`: the only ones assessed. */
function nightsBetween(from: number, to: number): string[] {
  return Array.from({ length: to - from }, (_, offset) => dayAt(from + offset));
}

const HIGHER: Effect = {
  sleepMinutes: -120,
  bedtimeMinutes: 45,
  stepsFactor: 1.3,
  hrvFactor: 0.92,
  heartRate: 2,
};
const LOWER: Effect = {
  sleepMinutes: 90,
  bedtimeMinutes: 40,
  stepsFactor: 0.6,
  hrvFactor: 0.9,
  heartRate: 2.5,
};

describe("detector behaviour on simulated people", () => {
  it("raises few flags in a steady year", () => {
    const warmUp = 120;
    const days = 330;
    let watch = 0;
    let warning = 0;
    let alert = 0;
    for (const seed of SEEDS.slice(0, STEADY_YEAR_PEOPLE)) {
      const history = scoreHistory(
        simulate(days, seed),
        DEFAULT_CONFIG,
        "bp2",
        nightsBetween(warmUp, days)
      );
      watch += runsAtLeast(history, 1, warmUp, days);
      warning += runsAtLeast(history, 2, warmUp, days);
      alert += runsAtLeast(history, 3, warmUp, days);
    }
    const years = (STEADY_YEAR_PEOPLE * (days - warmUp)) / 365;
    expect(watch / years).toBeLessThan(14);
    expect(warning / years).toBeLessThan(3);
    expect(alert / years).toBeLessThan(0.5);
  });

  it("flags a week of about two hours less sleep, later bedtimes and more steps within five nights", () => {
    let warned = 0;
    let rightWay = 0;
    for (const seed of SEEDS) {
      const history = scoreHistory(
        simulate(ONSET + 40, seed, episode(ONSET, 3, 4, 2, HIGHER)),
        DEFAULT_CONFIG,
        "bp2",
        nightsBetween(ONSET, ONSET + 8)
      );
      if (peakTier(history, ONSET, ONSET + 6) >= 2) warned++;
      const flagged = [ONSET + 4, ONSET + 5, ONSET + 6]
        .map((index) => history.assessments.get(dayAt(index)))
        .filter((assessment) => assessment && assessment.tier !== "none");
      if (flagged.length > 0 && flagged.every((a) => a?.direction === "hyper")) {
        rightWay++;
      }
    }
    expect(warned / SEEDS.length).toBeGreaterThanOrEqual(0.55);
    expect(rightWay / SEEDS.length).toBeGreaterThanOrEqual(0.6);
  });

  it("flags a slow slide into longer sleep and fewer steps, and keeps showing it", () => {
    let noticed = 0;
    let stillShowing = 0;
    for (const seed of SEEDS) {
      const history = scoreHistory(
        simulate(ONSET + 70, seed, episode(ONSET, 7, 40, 7, LOWER)),
        DEFAULT_CONFIG,
        "bp2",
        nightsBetween(ONSET, ONSET + 28)
      );
      if (peakTier(history, ONSET, ONSET + 14) >= 1) noticed++;
      if ([14, 17, 20, 23, 26].some((offset) => flaggedOn(history, ONSET + offset))) {
        stillShowing++;
      }
    }
    expect(noticed / SEEDS.length).toBeGreaterThanOrEqual(0.9);
    expect(stillShowing / SEEDS.length).toBeGreaterThanOrEqual(0.5);
  });

  it("does not let one all-nighter and a recovery sleep reach an alert", () => {
    let warned = 0;
    for (const seed of SEEDS) {
      const history = scoreHistory(
        simulate(200, seed, (index) =>
          index === ONSET
            ? { sleepMinutes: -300, bedtimeMinutes: 150 }
            : index === ONSET + 1
              ? { sleepMinutes: 200 }
              : null
        ),
        DEFAULT_CONFIG,
        "bp2",
        nightsBetween(ONSET, ONSET + 10)
      );
      expect(peakTier(history, ONSET, ONSET + 10)).toBeLessThan(3);
      if (peakTier(history, ONSET, ONSET + 10) >= 2) warned++;
    }
    expect(warned / SEEDS.length).toBeLessThanOrEqual(0.4);
  });

  it("stops flagging a lasting change once it has become the new usual", () => {
    let early = 0;
    let late = 0;
    let nights = 0;
    for (const seed of SEEDS) {
      const history = scoreHistory(
        simulate(ONSET + 130, seed, (index) =>
          index >= ONSET ? { sleepMinutes: -75, stepsFactor: 1.12 } : null
        ),
        DEFAULT_CONFIG,
        "bp2",
        [...nightsBetween(ONSET + 3, ONSET + 23), ...nightsBetween(ONSET + 100, ONSET + 120)]
      );
      for (let offset = 0; offset < 20; offset++) {
        if (flaggedOn(history, ONSET + 3 + offset)) early++;
        if (flaggedOn(history, ONSET + 100 + offset)) late++;
        nights++;
      }
    }
    expect(late / nights).toBeLessThan(0.07);
    expect(early / nights).toBeGreaterThan(2 * (late / nights));
  });
});
