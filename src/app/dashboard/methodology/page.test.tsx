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
import {
  LOWER_VIEW_DAYS,
  LOWER_VIEW_MIN_NIGHTS,
} from "@/lib/analysis/persistence";
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

describe("Methodology page flagging rules", () => {
  // Evidence bars are lowered so the night counts are what decides the tier.
  const config = {
    ...DEFAULT_CONFIG,
    watchMinConfidence: 0,
    warningMinConfidence: 0,
    alertMinConfidence: 0,
  };
  const CONCERNING = DEFAULT_CONFIG.concernThreshold + 1;
  const QUIET = DEFAULT_CONFIG.concernThreshold - 0.1;

  function nightsOf(pattern: boolean[], activation: number): DailyAnalysisResult[] {
    return pattern.map((concerning, index) => ({
      day: `2026-07-${String(index + 1).padStart(2, "0")}`,
      metrics: metrics(`2026-07-${String(index + 1).padStart(2, "0")}`),
      baselines: {},
      zScores: { withinNightVar: 1, activity: 1, circadianIV: 1 },
      compositeScore: concerning ? CONCERNING : QUIET,
      isAnomaly: concerning,
      direction: concerning ? (activation > 0 ? "hyper" : "hypo") : null,
      notes: "",
      activation: concerning ? activation : activation / 2,
    }));
  }

  function tierOf(pattern: boolean[], activation = 1) {
    const nights = nightsOf(pattern, activation);
    return assessEpisode(nights[nights.length - 1].day, nights, [], config).tier;
  }

  const [watchNights, warningNights, alertNights, alertSpan] = numbersIn(
    /Watch needs (\d+) such nights in a row, Warning (\d+) and Alert (\d+) of the last (\d+)/
  );

  it("states the minimum nights the detector is configured with", () => {
    expect([watchNights, warningNights, alertNights]).toEqual([
      DEFAULT_CONFIG.watchMinDays,
      DEFAULT_CONFIG.warningMinDays,
      DEFAULT_CONFIG.alertMinDays,
    ]);
  });

  it("raises Watch and Warning only after the stated unbroken run", () => {
    const endingIn = (run: number) => [...Array(7 - run).fill(false), ...Array(run).fill(true)];
    expect(tierOf(endingIn(watchNights - 1))).toBe("none");
    expect(tierOf(endingIn(watchNights))).toBe("watch");
    expect(tierOf(endingIn(warningNights - 1))).toBe("watch");
    expect(tierOf(endingIn(warningNights))).toBe("warning");
  });

  it("raises Alert on the stated count of the stated last nights, with gaps allowed", () => {
    const gaps = alertSpan - alertNights;
    // Quiet nights come early, so the last night is still a concerning one.
    const quietAt = [1, 4, 2, 3];
    const pattern = (quiet: number) =>
      Array.from({ length: alertSpan }, (_, index) => !quietAt.slice(0, quiet).includes(index));
    expect(pattern(gaps).filter(Boolean)).toHaveLength(alertNights);
    expect(tierOf(pattern(gaps))).toBe("alert");
    expect(tierOf(pattern(gaps + 1))).not.toBe("alert");
  });

  it("counts only nights that lean the same way as the pattern toward Alert", () => {
    const nights = nightsOf(Array(alertSpan).fill(true), 1).map((night, index) =>
      index < alertSpan - alertNights + 1 ? { ...night, activation: -0.2 } : night
    );
    const last = nights[nights.length - 1].day;
    expect(assessEpisode(last, nights, [], config).tier).not.toBe("alert");
  });

  it("stops an unclear pattern at Watch", () => {
    expect(tierOf(Array(alertSpan).fill(true), 0)).toBe("watch");
  });

  describe("the two-week check", () => {
    const [days, watchK, warningK, alertK] = numbersIn(
      /Over the last (\d+) nights, (\d+), (\d+) or (\d+) nights leaning toward lower activation/
    );

    it("states the span and the counts the detector uses", () => {
      expect([days, watchK, warningK, alertK]).toEqual([
        LOWER_VIEW_DAYS,
        LOWER_VIEW_MIN_NIGHTS.watch,
        LOWER_VIEW_MIN_NIGHTS.warning,
        LOWER_VIEW_MIN_NIGHTS.alert,
      ]);
    });

    // The first seven nights fill up first; the rest are spread so the last
    // night is quiet and no short rule fires before the two-week one.
    const fortnight = (count: number) => {
      const pattern: boolean[] = Array(days).fill(false);
      const order = [0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12, 8];
      order.slice(0, count).forEach((index) => (pattern[index] = true));
      return pattern;
    };

    it("raises each tier at the stated count of lower-leaning nights, and not one night sooner", () => {
      expect(tierOf(fortnight(watchK - 1), -1)).toBe("none");
      expect(tierOf(fortnight(watchK), -1)).toBe("watch");
      expect(tierOf(fortnight(warningK - 1), -1)).toBe("watch");
      expect(tierOf(fortnight(warningK), -1)).toBe("warning");
      expect(tierOf(fortnight(alertK - 1), -1)).toBe("warning");
      expect(tierOf(fortnight(alertK), -1)).toBe("alert");
    });

    it("leaves the same nights unflagged when they lean toward higher activation", () => {
      expect(tierOf(fortnight(warningK), 1)).toBe("none");
    });
  });
});
