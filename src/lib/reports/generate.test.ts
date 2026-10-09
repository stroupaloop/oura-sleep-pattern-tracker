import { describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ rows: new Map<unknown, unknown[]>() }));

vi.mock("@/lib/db", () => {
  const builder = (table?: unknown): unknown => {
    const query: Record<string, unknown> = {
      from: (source: unknown) => builder(source),
      where: () => query,
      orderBy: () => query,
      limit: () => query,
      then: (
        resolve: (rows: unknown) => unknown,
        reject: (error: unknown) => unknown
      ) => Promise.resolve(fixtures.rows.get(table) ?? []).then(resolve, reject),
    };
    return query;
  };
  return { db: { select: () => builder() } };
});

import {
  dailyActivity,
  dailyMood,
  episodeAssessments,
  medicationLogs,
  medications,
  sleepPeriods,
} from "@/lib/db/schema";
import { computeTrend, generateReport, summarizeMood } from "./generate";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random: () => number) {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

const SERIES_PER_CASE = 2000;
const MAX_FALSE_TREND_RATE = 0.06;

function noisySeries(
  random: () => number,
  n: number,
  level: number,
  cv: number,
  options: { drift?: number; wholeNumbers?: boolean } = {}
) {
  return Array.from({ length: n }, (_, i) => {
    const value = Math.max(
      1,
      level * (1 + (options.drift ?? 0) * (i / (n - 1)) + cv * gaussian(random))
    );
    return options.wholeNumbers ? Math.round(value) : value;
  });
}

function trendRate(
  expected: "increasing" | "decreasing" | "any",
  n: number,
  level: number,
  cv: number,
  options: { drift?: number; wholeNumbers?: boolean },
  seed: number
) {
  const random = seededRandom(seed);
  let hits = 0;
  for (let i = 0; i < SERIES_PER_CASE; i++) {
    const trend = computeTrend(noisySeries(random, n, level, cv, options));
    if (expected === "any" ? trend !== "stable" : trend === expected) hits++;
  }
  return hits / SERIES_PER_CASE;
}

function ramp(n: number, start: number, totalChange: number) {
  return Array.from({ length: n }, (_, i) => start + (totalChange * i) / (n - 1));
}

describe("computeTrend", () => {
  it("reports insufficient data below the seven-observation minimum", () => {
    expect(computeTrend([])).toBe("insufficient_data");
    expect(computeTrend([1, 2, 3, 4, 5, 6])).toBe("insufficient_data");
    expect(computeTrend([1, 2, 3, 4, 5, 6, Number.NaN])).toBe(
      "insufficient_data"
    );
  });

  it("calls a steady one-way run of seven values a trend", () => {
    expect(computeTrend([100, 102, 104, 106, 108, 110, 112])).toBe(
      "increasing"
    );
    expect(computeTrend([112, 110, 108, 106, 104, 102, 100])).toBe(
      "decreasing"
    );
  });

  it("calls a constant or fully tied series stable", () => {
    expect(computeTrend([100, 100, 100, 100, 100, 100, 100])).toBe("stable");
    expect(computeTrend([0, 0, 0, 0, 0, 0, 0, 0])).toBe("stable");
    expect(computeTrend([5, 5, 5, 5, 5, 5, 6])).toBe("stable");
  });

  it("needs a Mann-Kendall z of 1.96 (p < 0.05): a 3-and-4 step over seven nights is not clear", () => {
    expect(computeTrend([100, 100, 100, 110, 110, 110, 110])).toBe("stable");
    expect(computeTrend([110, 110, 110, 100, 100, 100, 100])).toBe("stable");
  });

  it("calls the same step clear once four nights sit on each side", () => {
    expect(computeTrend([100, 100, 100, 100, 110, 110, 110, 110])).toBe(
      "increasing"
    );
    expect(computeTrend([110, 110, 110, 110, 100, 100, 100, 100])).toBe(
      "decreasing"
    );
  });

  it("ignores a clear drift of under 5% of the typical value", () => {
    expect(computeTrend(ramp(27, 100, 4.8))).toBe("stable");
    expect(computeTrend(ramp(27, 100, -4.8))).toBe("stable");
  });

  it("reports a clear drift of at least 5% of the typical value", () => {
    expect(computeTrend(ramp(27, 100, 5.3))).toBe("increasing");
    expect(computeTrend(ramp(27, 100, -5.3))).toBe("decreasing");
  });

  it("ignores values that are not numbers", () => {
    const series = [...ramp(10, 100, 12), Number.NaN, Number.POSITIVE_INFINITY];
    expect(computeTrend(series)).toBe("increasing");
  });

  it("does not read a weekend-long-sleep rhythm across four whole weeks as a trend", () => {
    const week = [7, 7, 7, 7, 7, 8.5, 8.5];
    expect(computeTrend([...week, ...week, ...week, ...week])).toBe("stable");
  });

  for (const n of [7, 14, 27]) {
    it(`calls a trend in at most 6% of ${SERIES_PER_CASE} stationary sleep series at n = ${n}`, () => {
      expect(
        trendRate("any", n, 6.7 * 3600, 0.11, {}, 100 + n)
      ).toBeLessThanOrEqual(MAX_FALSE_TREND_RATE);
    });

    it(`calls a trend in at most 6% of ${SERIES_PER_CASE} stationary whole-number HRV series at n = ${n}`, () => {
      expect(
        trendRate("any", n, 50, 0.25, { wholeNumbers: true }, 200 + n)
      ).toBeLessThanOrEqual(MAX_FALSE_TREND_RATE);
    });
  }

  it("detects a clear 10% rise over 27 values", () => {
    expect(computeTrend(ramp(27, 100, 10))).toBe("increasing");
    expect(
      trendRate("increasing", 27, 7 * 3600, 0.02, { drift: 0.1 }, 301)
    ).toBeGreaterThanOrEqual(0.95);
  });

  it("detects a clear 10% fall over 27 values", () => {
    expect(computeTrend(ramp(27, 110, -10))).toBe("decreasing");
    expect(
      trendRate("decreasing", 27, 7 * 3600, 0.02, { drift: -0.1 }, 302)
    ).toBeGreaterThanOrEqual(0.95);
  });
});

describe("summarizeMood", () => {
  it("shows the spread of a +3/-3 cycle that averages to zero", () => {
    const cycle = Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 3 : -3));
    expect(summarizeMood(cycle)).toEqual({
      entries: 20,
      average: 0,
      lowest: -3,
      highest: 3,
      highDays: 10,
      lowDays: 10,
    });
  });

  it("counts days at +2 or above and at -2 or below, and nothing milder", () => {
    const mood = summarizeMood([-3, -2, -1, 0, 1, 2, 3, 2]);
    expect(mood.highDays).toBe(3);
    expect(mood.lowDays).toBe(2);
  });

  it("has no range when nothing was logged", () => {
    expect(summarizeMood([])).toEqual({
      entries: 0,
      average: null,
      lowest: null,
      highest: null,
      highDays: 0,
      lowDays: 0,
    });
  });
});

function night(day: string, hours: number, hrv: number) {
  const start = new Date(`${day}T03:00:00Z`);
  const end = new Date(start.getTime() + hours * 3600_000);
  return {
    day,
    type: "long_sleep",
    bedtimeStart: start.toISOString(),
    bedtimeEnd: end.toISOString(),
    totalSleepDuration: Math.round(hours * 3600),
    timeInBed: Math.round(hours * 3600 + 1800),
    averageHrv: hrv,
  };
}

function septemberDay(index: number) {
  return new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10);
}

function seedReportRows(options: {
  sleepHours: (index: number) => number | null;
  moods: number[];
}) {
  const nights = Array.from({ length: 30 }, (_, i) => {
    const hours = options.sleepHours(i);
    return hours === null ? null : night(septemberDay(i), hours, 55);
  }).filter((row) => row !== null);
  fixtures.rows.set(sleepPeriods, nights);
  fixtures.rows.set(dailyActivity, []);
  fixtures.rows.set(
    dailyMood,
    options.moods.map((moodScore, i) => ({ day: septemberDay(i), moodScore }))
  );
  fixtures.rows.set(episodeAssessments, []);
  fixtures.rows.set(medications, []);
  fixtures.rows.set(medicationLogs, []);
}

describe("generateReport", () => {
  it("reports the range and extreme-day counts of a +3/-3 mood cycle", async () => {
    seedReportRows({
      sleepHours: () => 7,
      moods: Array.from({ length: 20 }, (_, i) => (i % 2 === 0 ? 3 : -3)),
    });

    const { summary } = await generateReport("2026-09-01", "2026-09-30");

    expect(summary.avgMood).toBe(0);
    expect(summary.moodEntries).toBe(20);
    expect(summary.moodMin).toBe(-3);
    expect(summary.moodMax).toBe(3);
    expect(summary.moodHighDays).toBe(10);
    expect(summary.moodLowDays).toBe(10);
  });

  it("leaves the mood range empty when nothing was logged", async () => {
    seedReportRows({ sleepHours: () => 7, moods: [] });

    const { summary } = await generateReport("2026-09-01", "2026-09-30");

    expect(summary.moodEntries).toBe(0);
    expect(summary.avgMood).toBeNull();
    expect(summary.moodMin).toBeNull();
    expect(summary.moodMax).toBeNull();
    expect(summary.moodHighDays).toBe(0);
    expect(summary.moodLowDays).toBe(0);
  });

  it("calls a clear fall in sleep a decreasing trend and flat sleep stable", async () => {
    seedReportRows({ sleepHours: (i) => 7.5 - (1.5 * i) / 29, moods: [] });
    expect(
      (await generateReport("2026-09-01", "2026-09-30")).trends.sleepTrend
    ).toBe("decreasing");

    seedReportRows({ sleepHours: () => 7, moods: [] });
    expect(
      (await generateReport("2026-09-01", "2026-09-30")).trends.sleepTrend
    ).toBe("stable");
  });
});
