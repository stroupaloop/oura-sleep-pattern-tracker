import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { format, startOfWeek, subWeeks } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractMetrics } from "@/lib/analysis/anomaly";
import { shiftIsoDay } from "@/lib/date-utils";
import { buildSignals, type NightAnalysis } from "@/lib/health/signals";
import { selectNightSleepByDay } from "@/lib/oura/main-sleep";
import { NightCardContent } from "./night-card";
import { SleepCalendar } from "./sleep-calendar";
import {
  buildSleepPageNights,
  SLEEP_PAGE_LOOKBACK_DAYS,
  type SleepPeriodRow,
} from "./sleep-page-data";

vi.mock("@/lib/db", () => ({ db: {} }));

function period(
  id: string,
  type: "long_sleep" | "sleep",
  day: string,
  bedtimeStart: string,
  bedtimeEnd: string,
  asleepMinutes: number,
  overrides: Partial<SleepPeriodRow> = {}
): SleepPeriodRow {
  const inBed = (Date.parse(bedtimeEnd) - Date.parse(bedtimeStart)) / 1000;
  const asleep = asleepMinutes * 60;
  return {
    id,
    day,
    type,
    bedtimeStart,
    bedtimeEnd,
    totalSleepDuration: asleep,
    deepSleepDuration: Math.round(asleep * 0.2),
    lightSleepDuration: Math.round(asleep * 0.55),
    remSleepDuration: Math.round(asleep * 0.25),
    awakeTime: inBed - asleep,
    efficiency: Math.round((asleep / inBed) * 100),
    latency: 600,
    averageHeartRate: 58,
    lowestHeartRate: 50,
    averageHrv: 40,
    temperatureDelta: null,
    averageBreath: null,
    restlessPeriods: 100,
    timeInBed: inBed,
    hr5min: null,
    hrv5min: null,
    hypnogram5min: null,
    createdAt: 0,
    ...overrides,
  };
}

const SHORT_NIGHT = period(
  "short",
  "sleep",
  "2026-10-03",
  "2026-10-03T03:00:00-04:00",
  "2026-10-03T05:10:00-04:00",
  120,
  { restlessPeriods: 40, averageHrv: 52 }
);
const NIGHT = period(
  "night",
  "long_sleep",
  "2026-10-04",
  "2026-10-03T23:00:00-04:00",
  "2026-10-04T06:00:00-04:00",
  400
);
const AFTERNOON = period(
  "afternoon",
  "long_sleep",
  "2026-10-04",
  "2026-10-04T14:00:00-04:00",
  "2026-10-04T17:40:00-04:00",
  200
);
const BROKEN_FIRST = period(
  "broken-first",
  "long_sleep",
  "2026-10-05",
  "2026-10-04T21:30:00-04:00",
  "2026-10-05T02:30:00-04:00",
  270,
  { latency: 900, averageHeartRate: 55, averageHrv: 45 }
);
const BROKEN_SECOND = period(
  "broken-second",
  "sleep",
  "2026-10-05",
  "2026-10-05T04:00:00-04:00",
  "2026-10-05T06:10:00-04:00",
  120,
  { latency: 300, averageHeartRate: 70, averageHrv: 20 }
);

const NO_TEMPERATURE = new Map<string, number | null>();

describe("buildSleepPageNights", () => {
  it("keeps a two-hour night Oura typed sleep, with its numbers", () => {
    const nights = buildSleepPageNights(
      [SHORT_NIGHT],
      new Map([["2026-10-03", 0.4]])
    );

    expect(Object.keys(nights)).toEqual(["2026-10-03"]);
    expect(nights["2026-10-03"]).toMatchObject({
      id: "short",
      day: "2026-10-03",
      totalSleepDuration: 120 * 60,
      deepSleepDuration: 24 * 60,
      lightSleepDuration: 66 * 60,
      remSleepDuration: 30 * 60,
      efficiency: 92,
      latency: 600,
      restlessPeriods: 40,
      averageHeartRate: 58,
      lowestHeartRate: 50,
      averageHrv: 52,
      temperatureDelta: 0.4,
    });
  });

  it("does not let an afternoon long sleep stand in for the night, whatever the row order", () => {
    for (const rows of [
      [NIGHT, AFTERNOON],
      [AFTERNOON, NIGHT],
    ]) {
      const night = buildSleepPageNights(rows, NO_TEMPERATURE)["2026-10-04"];

      expect(night.id).toBe("night");
      expect(night.totalSleepDuration).toBe(400 * 60);
      expect(night.bedtimeStart).toBe("2026-10-03T23:00:00-04:00");
    }
  });

  it("shows a broken night as one night, the same one the pattern checks store", () => {
    const rows = [BROKEN_FIRST, BROKEN_SECOND];
    const night = buildSleepPageNights(rows, NO_TEMPERATURE)["2026-10-05"];
    const stored = extractMetrics(
      selectNightSleepByDay(rows).get("2026-10-05")!
    )!;

    expect(night.totalSleepDuration).toBe(390 * 60);
    expect(night.totalSleepDuration! / 60).toBe(stored.totalSleepMinutes);
    expect(night.efficiency).toBe(91);
    expect(night.efficiency).toBe(stored.efficiency);
    expect(night.latency! / 60).toBe(stored.onsetLatencyMinutes);
    expect(night.deepSleepDuration).toBe(
      BROKEN_FIRST.deepSleepDuration! + BROKEN_SECOND.deepSleepDuration!
    );
    expect(night.averageHeartRate).toBe(55);
    expect(night.averageHeartRate).toBe(stored.avgHeartRate);
    expect(night.averageHrv).toBe(stored.avgHrv);
  });

  it("starts the hypnogram at the longest period's bedtime when that is not the first", () => {
    const first = period(
      "early",
      "sleep",
      "2026-10-06",
      "2026-10-05T21:30:00-04:00",
      "2026-10-05T23:00:00-04:00",
      80
    );
    const longest = period(
      "late",
      "long_sleep",
      "2026-10-06",
      "2026-10-06T00:30:00-04:00",
      "2026-10-06T06:30:00-04:00",
      330,
      {
        hypnogram5min: "2212",
        hr5min: JSON.stringify({
          timestamp: "2026-10-06T00:30:00-04:00",
          interval: 300,
          items: [60, 56, 54],
        }),
      }
    );

    const night = buildSleepPageNights([first, longest], NO_TEMPERATURE)[
      "2026-10-06"
    ];

    expect(night.totalSleepDuration).toBe(410 * 60);
    expect(night.id).toBe("late");
    expect(night.bedtimeStart).toBe("2026-10-06T00:30:00-04:00");
    expect(night.hypnogram5min).toBe("2212");
    expect(night.hr5min).toBe(longest.hr5min);
    expect(JSON.parse(night.hr5min!).timestamp).toBe(night.bedtimeStart);
    expect(night.averageHeartRate).toBeCloseTo(56.67, 2);
    expect(night.lowestHeartRate).toBe(54);
  });

  it("has no night for a day with only a nap or a brief doze", () => {
    const nap = period(
      "nap",
      "sleep",
      "2026-10-02",
      "2026-10-02T13:00:00-04:00",
      "2026-10-02T14:30:00-04:00",
      80
    );
    const doze = period(
      "doze",
      "sleep",
      "2026-10-01",
      "2026-10-01T21:00:00-04:00",
      "2026-10-01T21:40:00-04:00",
      30
    );

    expect(
      buildSleepPageNights([nap, doze, SHORT_NIGHT], NO_TEMPERATURE)
    ).toEqual(buildSleepPageNights([SHORT_NIGHT], NO_TEMPERATURE));
    expect(buildSleepPageNights([nap, doze], NO_TEMPERATURE)).toEqual({});
  });

  it("loads far enough back for the calendar's first cell on every weekday", () => {
    for (let offset = 0; offset < 7; offset++) {
      const today = shiftIsoDay("2026-10-05", offset)!;
      const firstCell = format(
        startOfWeek(subWeeks(new Date(`${today}T12:00:00`), 4), {
          weekStartsOn: 1,
        }),
        "yyyy-MM-dd"
      );

      expect(shiftIsoDay(today, -SLEEP_PAGE_LOOKBACK_DAYS)! <= firstCell).toBe(
        true
      );
    }
  });
});

const NO_ANALYSIS: NightAnalysis = {
  day: "",
  totalSleepMinutes: null,
  baselineSleepMinutes: null,
  sleepDurationZScore: null,
  bedtimeStartMinutes: null,
  baselineBedtimeMinutes: null,
  bedtimeZScore: null,
  wakeTimeMinutes: null,
  baselineWakeMinutes: null,
  wakeTimeZScore: null,
  onsetLatencyMinutes: null,
  baselineLatency: null,
  latencyZScore: null,
  avgHrv: null,
  baselineHrv: null,
  hrvZScore: null,
  avgHeartRate: null,
  baselineHeartRate: null,
  heartRateZScore: null,
  temperatureDeviation: null,
  baselineTemperature: null,
  temperatureZScore: null,
  efficiency: null,
  baselineEfficiency: null,
  efficiencyZScore: null,
};

describe("the night card for a broken night", () => {
  it("sets its headline beside a comparison of the same night", () => {
    const rows = [BROKEN_FIRST, BROKEN_SECOND];
    const night = buildSleepPageNights(rows, NO_TEMPERATURE)["2026-10-05"];
    const stored = extractMetrics(
      selectNightSleepByDay(rows).get("2026-10-05")!
    )!;
    const signals = buildSignals(
      {
        ...NO_ANALYSIS,
        day: "2026-10-05",
        totalSleepMinutes: stored.totalSleepMinutes,
        baselineSleepMinutes: 440,
        sleepDurationZScore: -1.2,
      },
      1.5
    );

    const html = renderToStaticMarkup(
      createElement(NightCardContent, {
        night,
        analysis: {
          hrvZScore: 0,
          sleepDurationZScore: -1.2,
          efficiencyZScore: 0,
          isAnomaly: false,
          anomalyDirection: null,
          sleep: signals.find((signal) => signal.key === "sleep") ?? null,
          efficiency: null,
          latency: null,
        },
        threshold: 1.5,
      })
    );

    expect(html).toMatch(/Total Sleep<\/p><\/div><p[^>]*>6h 30m<\/p>/);
    expect(html).toContain("50m less than usual");
    expect(html).toContain("usual 7h 20m");
  });
});

describe("the calendar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T16:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderCalendar(
    nights: ReturnType<typeof buildSleepPageNights>,
    scores: Record<string, number> = {}
  ) {
    return renderToStaticMarkup(
      createElement(SleepCalendar, {
        nights,
        scores,
        analyses: {},
        threshold: 1.5,
      })
    );
  }

  it("opens on a night typed sleep instead of saying there is no sleep data", () => {
    const html = renderCalendar(
      buildSleepPageNights([SHORT_NIGHT], NO_TEMPERATURE),
      { "2026-10-03": 78 }
    );

    expect(html).toContain("Fri, Oct 2 → Sat, Oct 3");
    expect(html).toContain("2h 0m");
    expect(html).not.toContain("No sleep data for this day");
  });

  it("still says so for a day without a night", () => {
    const html = renderCalendar({});

    expect(html).toContain("No sleep data for this day");
    expect(html).toContain("Night of Tue, Oct 6 to Wed, Oct 7; no sleep data");
  });
});
