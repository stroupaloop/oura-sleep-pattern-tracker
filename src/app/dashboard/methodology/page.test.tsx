import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  computeDailyAnalysis,
  type DailyAnalysisResult,
  type DayMetrics,
} from "@/lib/analysis/anomaly";
import {
  DEFAULT_CONFIG,
  DEFAULT_WEIGHTS,
  SENSITIVITY_PRESETS,
  type DetectionConfigValues,
} from "@/lib/analysis/config";
import { assessEpisode } from "@/lib/analysis/episode";
import MethodologyPage from "./page";

const html = renderToStaticMarkup(<MethodologyPage />);
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;/g, "'")
  .replace(/\s+/g, " ");

function day(index: number): string {
  return `2026-07-${String(index + 1).padStart(2, "0")}`;
}

function metrics(dayLabel: string, patch: Partial<DayMetrics> = {}): DayMetrics {
  return {
    day: dayLabel,
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
    temperatureDeviation: Number.NaN,
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
    ...patch,
  };
}

function numbersIn(pattern: RegExp): number[] {
  const found = text.match(pattern);
  if (!found) throw new Error(`The page does not say: ${pattern}`);
  return found.slice(1).map(Number);
}

function splitTopLevel(list: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const character of list) {
    if (character === "(") depth++;
    if (character === ")") depth--;
    if (character === "," && depth === 0) {
      items.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

describe("Methodology page measure count", () => {
  const count = Object.keys(DEFAULT_WEIGHTS).length;

  it("says the same number of measures in the pipeline and the metrics list, never 14+ or 16+", () => {
    expect(text).toContain(`Each day, ${count} measures are compared`);
    expect(text).toContain(`${count} measures are scored every night`);
    expect(text).not.toMatch(/\b1[46]\+/);
  });

  it("lists exactly that many scored measures across its category cards", () => {
    const lists = [...html.matchAll(/Scored:<\/span>\s*([^<]*)<\/p>/g)].map(
      (match) => match[1]
    );
    expect(lists.length).toBeGreaterThan(0);
    expect(lists.flatMap(splitTopLevel)).toHaveLength(count);
  });
});

describe("Methodology page baseline", () => {
  it("says which nights make a night's usual, from the window the detector uses", () => {
    expect(text).toContain(
      `the ${DEFAULT_CONFIG.baselineDays} nights before the latest ${DEFAULT_CONFIG.baselineGuardDays}`
    );
    expect(text).not.toMatch(/30-day/);
  });
});

describe("Methodology page fixed rules", () => {
  const prior = Array.from({ length: 14 }, (_, i) => metrics(day(i)));

  function score(patch: Partial<DayMetrics>): number {
    const result = computeDailyAnalysis(
      metrics(day(14), patch),
      prior,
      DEFAULT_CONFIG
    );
    return result!.compositeScore;
  }

  it("describes the short-night bonus the detector adds", () => {
    const [hours, bonus] = numbersIn(
      /a night under (\d+(?:\.\d+)?) hours adds (\d+(?:\.\d+)?)/
    );
    expect(score({ totalSleepMinutes: hours * 60 - 1 })).toBeCloseTo(bonus, 10);
    expect(score({ totalSleepMinutes: hours * 60 })).toBe(0);
  });

  it("describes the low-efficiency bonus the detector adds", () => {
    const [percent, bonus] = numbersIn(
      /sleep efficiency under (\d+)% adds (\d+(?:\.\d+)?)/
    );
    expect(score({ efficiency: percent - 1 })).toBeCloseTo(bonus, 10);
    expect(score({ efficiency: percent })).toBe(0);
  });

  it("says that both can apply on one night and still cannot flag it alone", () => {
    const [line] = numbersIn(
      /the line is (\d+(?:\.\d+)?) at Medium sensitivity/
    );
    const both = score({ totalSleepMinutes: 100, efficiency: 10 });
    expect(both).toBeCloseTo(0.8, 10);
    expect(both).toBeLessThan(line);
    expect(line).toBe(DEFAULT_CONFIG.dailyAnomalyThreshold);
  });
});

describe("Methodology page easing rule", () => {
  function night(
    index: number,
    compositeScore: number,
    direction: "hyper" | "hypo"
  ): DailyAnalysisResult {
    return {
      day: day(index),
      metrics: metrics(day(index)),
      baselines: {},
      zScores: { withinNightVar: 1, activity: 1, circadianIV: 1 },
      compositeScore,
      isAnomaly: true,
      direction,
      notes: "",
    };
  }

  function tierAfterDrop(
    config: DetectionConfigValues,
    direction: "hyper" | "hypo",
    drop: number
  ) {
    const peak = 8;
    const nights = [peak, peak, peak, peak, peak, peak, peak * (1 - drop)].map(
      (score, index) => night(index, score, direction)
    );
    return assessEpisode(day(6), nights, [], config).tier;
  }

  const [medium, low, high] = numbersIn(
    /a drop of more than (\d+)% of that peak at Medium sensitivity \((\d+)% at Low, (\d+)% at High\)/
  );
  const [extra] = numbersIn(/need a drop (\d+) percentage points larger/);
  const stated = {
    low: { limit: low / 100, preset: SENSITIVITY_PRESETS.low },
    medium: { limit: medium / 100, preset: SENSITIVITY_PRESETS.medium },
    high: { limit: high / 100, preset: SENSITIVITY_PRESETS.high },
  };

  for (const [name, { limit, preset }] of Object.entries(stated)) {
    const config = { ...DEFAULT_CONFIG, ...preset };

    it(`clears a higher-activation flag only past the stated drop at ${name} sensitivity`, () => {
      expect(tierAfterDrop(config, "hyper", limit - 0.02)).not.toBe("none");
      expect(tierAfterDrop(config, "hyper", limit + 0.02)).toBe("none");
    });

    it(`gives a lower-activation flag the stated extra room at ${name} sensitivity`, () => {
      const room = Math.min(limit + extra / 100, 1);
      expect(tierAfterDrop(config, "hypo", room - 0.02)).not.toBe("none");
      expect(tierAfterDrop(config, "hypo", room + 0.02)).toBe("none");
    });
  }
});

describe("Methodology page pattern profiles", () => {
  const prior = Array.from({ length: 20 }, (_, i) =>
    metrics(day(i), {
      totalSleepMinutes: 420 + (i % 5) * 12,
      withinNightHrvCV: 0.25 + (i % 3) * 0.02,
      withinNightHrCV: 0.07 + (i % 4) * 0.005,
      hypnogramFragmentation: 0.2 + (i % 3) * 0.01,
    })
  );
  const unusual = metrics(day(20), {
    totalSleepMinutes: 300,
    withinNightHrvCV: 0.5,
    withinNightHrCV: 0.2,
    hypnogramFragmentation: 0.4,
  });
  const score = (type: "bp1" | "bp2" | "unspecified") =>
    computeDailyAnalysis(unusual, prior, DEFAULT_CONFIG, type)!.compositeScore;

  it("says every profile scores a night the same way, as they do", () => {
    expect(score("bp1")).toBeGreaterThan(0);
    expect(score("bp1")).toBe(score("unspecified"));
    expect(score("bp2")).toBe(score("unspecified"));
    expect(text).toContain("Uses the base daily metric weights and the default");
    expect(text).toContain("scores the same as Not specified");
    expect(text).not.toMatch(/exploratory within-night variability/);
  });
});
