import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ActivityRecoveryChart,
  ActivityTooltipContent,
  StressTooltipContent,
} from "./activity-recovery-chart";
import {
  GapNote,
  NoNightTooltip,
  countGaps,
  hasValues,
  isolatedDot,
} from "./chart-gaps";
import { CircadianChart, CircadianTooltipContent } from "./circadian-chart";
import { CustomTooltip, SleepCompositionBar } from "./sleep-composition-bar";
import {
  DurationTooltipContent,
  HrTooltipContent,
  HrvTooltipContent,
  SleepTrendChart,
  mergeHrData,
  mergeHrvData,
} from "./sleep-trend-chart";
import {
  VariabilityChart,
  VariabilityTooltipContent,
} from "./variability-chart";
import {
  WithinNightChart,
  WithinNightTooltipContent,
} from "./within-night-chart";

const ONE_GAP = "1 night has no recording and appears as a gap.";
const TWO_GAPS = "2 nights have no recording and appear as gaps.";

function count(html: string, text: string) {
  return html.split(text).length - 1;
}

function words(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

describe("GapNote", () => {
  it("counts the days with no night, in the singular and the plural", () => {
    const rows = [{}, { noNight: true }, {}, { noNight: true }];

    expect(countGaps(rows)).toBe(2);
    expect(renderToStaticMarkup(createElement(GapNote, { rows }))).toContain(
      TWO_GAPS
    );
    expect(
      renderToStaticMarkup(
        createElement(GapNote, { rows: [{ noNight: true }, {}] })
      )
    ).toContain(ONE_GAP);
  });

  it("says nothing when no night is missing", () => {
    expect(
      renderToStaticMarkup(createElement(GapNote, { rows: [{}, {}] }))
    ).toBe("");
    expect(renderToStaticMarkup(createElement(GapNote, { rows: [] }))).toBe("");
  });
});

describe("NoNightTooltip", () => {
  it("names the night and says none was recorded", () => {
    const html = renderToStaticMarkup(
      createElement(NoNightTooltip, { title: "Sep 28 → Sep 29" })
    );

    expect(html).toContain("Sep 28 → Sep 29");
    expect(html).toContain("No night recorded");
  });
});

describe("hasValues", () => {
  it("is true when any series has a value for the hovered day", () => {
    expect(hasValues([{ value: null }, { value: 0 }])).toBe(true);
    expect(hasValues([{ value: null }, { value: undefined }, {}])).toBe(false);
    expect(hasValues([])).toBe(false);
  });
});

describe("isolatedDot", () => {
  function dotAt(index: number, ys: Array<number | null>) {
    return isolatedDot({
      cx: index * 10,
      cy: ys[index] ?? undefined,
      index,
      points: ys.map((y, at) => ({ x: at * 10, y })),
      stroke: "var(--series-hrv)",
      dataKey: "hrv",
      value: ys[index],
      payload: {},
    });
  }

  it("gives a night with a gap or the edge on both sides a dot in its series color", () => {
    const html = renderToStaticMarkup(<>{dotAt(1, [null, 40, null])}</>);

    expect(html).toBe('<circle cx="10" cy="40" r="3" fill="var(--series-hrv)"></circle>');
    expect(dotAt(0, [40, null, 50])).not.toBeNull();
    expect(dotAt(0, [40])).not.toBeNull();
    expect(dotAt(2, [null, null, 40])).not.toBeNull();
  });

  it("leaves a night with a neighbour to the line, and draws nothing at a gap", () => {
    expect(dotAt(1, [40, 41, null])).toBeNull();
    expect(dotAt(1, [null, 41, 42])).toBeNull();
    expect(dotAt(1, [null, null, 42])).toBeNull();
  });
});

type TrendRow = ComponentProps<typeof SleepTrendChart>["data"][number];
type TrendAnalysis = NonNullable<
  ComponentProps<typeof SleepTrendChart>["analysisData"]
>[number];

const night = (day: string, hrv = 42, hr = 58): TrendRow => ({
  day,
  hours: 7,
  deep: 1.4,
  rem: 1.7,
  light: 3.9,
  efficiency: 90,
  hrv,
  hr,
});
const noNight = (day: string): TrendRow => ({
  day,
  hours: null,
  deep: null,
  rem: null,
  light: null,
  efficiency: null,
  hrv: null,
  hr: null,
  noNight: true,
});
const usual = (day: string): TrendAnalysis => ({
  day,
  baselineHrv: 41,
  baselineHeartRate: 57,
  isAnomaly: 0,
  anomalyDirection: null,
  hrvZScore: 0.3,
  heartRateZScore: 0.2,
});

const WITH_HOLE: TrendRow[] = [
  night("2026-10-01", 40, 60),
  noNight("2026-10-02"),
  noNight("2026-10-03"),
  night("2026-10-04", 44, 56),
];

describe("SleepTrendChart with missing nights", () => {
  it("says under each of its three charts how many nights are missing", () => {
    const html = renderToStaticMarkup(
      createElement(SleepTrendChart, { data: WITH_HOLE })
    );

    expect(count(html, TWO_GAPS)).toBe(3);
  });

  it("says nothing when every night is there", () => {
    const html = renderToStaticMarkup(
      createElement(SleepTrendChart, {
        data: [night("2026-10-01"), night("2026-10-02"), night("2026-10-03")],
      })
    );

    expect(html).not.toContain("no recording");
  });

  it("carries a missing night through as nulls, never as zero or NaN", () => {
    const analysis = WITH_HOLE.filter((row) => !row.noNight).map((row) =>
      usual(row.day)
    );

    const hrv = mergeHrvData(WITH_HOLE, analysis, 1.5);
    const hr = mergeHrData(WITH_HOLE, analysis, 1.5);

    expect(hrv[1]).toEqual({
      day: "2026-10-02",
      hrv: null,
      hrvAvg: null,
      baselineHrv: null,
      isDeviation: false,
      noNight: true,
    });
    expect(hr[2]).toEqual({
      day: "2026-10-03",
      hr: null,
      hrAvg: null,
      baselineHr: null,
      isDeviation: false,
      noNight: true,
    });
    for (const row of [...hrv, ...hr]) {
      for (const value of Object.values(row)) {
        if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it("averages the nights that are there and stops the average at a gap", () => {
    const hrv = mergeHrvData(WITH_HOLE, undefined, 1.5);

    expect(hrv.map((row) => row.hrvAvg)).toEqual([40, null, null, 42]);
    expect(hrv[0].noNight).toBe(false);
  });

  it("only flags the nights it has a score for", () => {
    const hrv = mergeHrvData(
      WITH_HOLE,
      [{ ...usual("2026-10-04"), hrvZScore: -1.8 }],
      1.5
    );

    expect(hrv.map((row) => row.isDeviation)).toEqual([false, false, false, true]);
  });

  it("answers a hover over a missing night in words, in all three tooltips", () => {
    const [, gap] = mergeHrvData(WITH_HOLE, undefined, 1.5);
    const [, gapHr] = mergeHrData(WITH_HOLE, undefined, 1.5);

    const hrvHtml = renderToStaticMarkup(
      createElement(HrvTooltipContent, {
        active: true,
        payload: [{ dataKey: "hrv", value: null, color: "", payload: gap }],
      })
    );
    const hrHtml = renderToStaticMarkup(
      createElement(HrTooltipContent, {
        active: true,
        payload: [{ dataKey: "hr", value: null, color: "", payload: gapHr }],
      })
    );
    const durationHtml = renderToStaticMarkup(
      createElement(DurationTooltipContent, {
        active: true,
        payload: [{ payload: noNight("2026-10-02") }],
      })
    );

    expect(words(hrvHtml)).toBe("Oct 1 → Oct 2 No night recorded");
    expect(words(hrHtml)).toBe("Oct 1 → Oct 2 No night recorded");
    expect(words(durationHtml)).toBe("Date: 2026-10-02 No night recorded");
  });

  it("keeps a hover with nothing to show from opening a tooltip, as before", () => {
    const [onlyNight] = mergeHrvData([night("2026-10-01")], undefined, 1.5);
    const empty = { ...onlyNight, hrv: null, hrvAvg: null };

    const hrvHtml = renderToStaticMarkup(
      createElement(HrvTooltipContent, {
        active: true,
        payload: [
          { dataKey: "hrv", value: null, color: "", payload: empty },
        ],
      })
    );
    const durationHtml = renderToStaticMarkup(
      createElement(DurationTooltipContent, {
        active: true,
        payload: [{ value: null, payload: { ...night("2026-10-01"), deep: null } }],
      })
    );

    expect(hrvHtml).toBe("");
    expect(durationHtml).toBe("");
  });

  it("gives each stage of a recorded night in hours, and a dash for one it lacks", () => {
    const html = renderToStaticMarkup(
      createElement(DurationTooltipContent, {
        active: true,
        payload: [{ value: 1.4, payload: { ...night("2026-10-01"), rem: null } }],
      })
    );

    expect(html).toContain("Deep");
    expect(html).toContain("1.4h");
    expect(html).toContain("3.9h");
    expect(html).toMatch(/REM<\/span><span[^>]*>--</);
    expect(html).not.toContain("No night recorded");
    expect(html).not.toContain("NaN");
  });
});

describe("SleepCompositionBar with missing nights", () => {
  const present = (day: string) => ({
    day,
    deep: 18.7,
    rem: 22.7,
    light: 52,
    awake: 6.7,
    deepMin: 84,
    remMin: 102,
    lightMin: 234,
    awakeMin: 30,
  });
  const missing = (day: string) => ({
    day,
    deep: null,
    rem: null,
    light: null,
    awake: null,
    deepMin: null,
    remMin: null,
    lightMin: null,
    awakeMin: null,
    noNight: true,
  });
  const days = [
    present("2026-10-01"),
    missing("2026-10-02"),
    present("2026-10-03"),
    missing("2026-10-04"),
  ];

  it("dates its title by the calendar days it covers and says how many have no night", () => {
    const html = renderToStaticMarkup(
      createElement(SleepCompositionBar, { data: days })
    );

    expect(html).toContain("share of time in bed, Oct 1 – Oct 4");
    expect(html).not.toContain("last 4 nights");
    expect(html).toContain(TWO_GAPS);
  });

  it("says nothing extra when every day has a night", () => {
    const html = renderToStaticMarkup(
      createElement(SleepCompositionBar, {
        data: [present("2026-10-01"), present("2026-10-02")],
      })
    );

    expect(html).not.toContain("no recording");
  });

  it("answers a hover over a day with no night in words, and a recorded one in stages", () => {
    const gapHtml = renderToStaticMarkup(
      createElement(CustomTooltip, {
        active: true,
        label: "2026-10-02",
        payload: [{ name: "Deep", value: null, color: "", payload: days[1] }],
      })
    );
    const nightHtml = renderToStaticMarkup(
      createElement(CustomTooltip, {
        active: true,
        label: "2026-10-01",
        payload: [{ name: "Deep", value: 18.7, color: "", payload: days[0] }],
      })
    );

    expect(words(gapHtml)).toBe("Oct 1 → Oct 2 No night recorded");
    expect(nightHtml).toContain("19% (1h 24m)");
    expect(nightHtml).not.toContain("No night recorded");
  });

  it("opens no tooltip over a day with a night but no stage values", () => {
    const html = renderToStaticMarkup(
      createElement(CustomTooltip, {
        active: true,
        label: "2026-10-02",
        payload: [
          {
            name: "Deep",
            value: null,
            color: "",
            payload: { ...missing("2026-10-02"), noNight: undefined },
          },
        ],
      })
    );

    expect(html).toBe("");
  });
});

describe("the Insights charts with missing nights", () => {
  const circadian = (day: string, missing = false) =>
    missing
      ? { day, is: null, iv: null, ra: null, noNight: true }
      : { day, is: 0.7, iv: 0.1, ra: 0.55 };
  const variability = (day: string, missing = false) =>
    missing
      ? { day, sleepCV: null, bedtimeCV: null, wakeCV: null, noNight: true }
      : { day, sleepCV: 0.08, bedtimeCV: 0.01, wakeCV: 0.012 };
  const withinNight = (day: string, missing = false) =>
    missing
      ? { day, hrvCV: null, hrCV: null, fragmentation: null, noNight: true }
      : { day, hrvCV: 0.25, hrCV: 0.08, fragmentation: 0.2 };
  const activity = (day: string, missing = false) =>
    missing
      ? {
          day,
          steps: null,
          activeMinutes: null,
          stressHigh: null,
          recoveryHigh: null,
          resilienceLevel: null,
          noNight: true,
        }
      : {
          day,
          steps: 8000,
          activeMinutes: 45,
          stressHigh: 60,
          recoveryHigh: 90,
          resilienceLevel: "solid",
        };

  const DAYS = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
  const rows = <T,>(make: (day: string, missing?: boolean) => T, holes: string[]) =>
    DAYS.map((day) => make(day, holes.includes(day)));
  const HOLE = ["2026-10-02", "2026-10-03"];

  it("says under the circadian chart how many nights are missing", () => {
    const withGaps = renderToStaticMarkup(
      createElement(CircadianChart, { data: rows(circadian, HOLE) })
    );
    const without = renderToStaticMarkup(
      createElement(CircadianChart, { data: rows(circadian, []) })
    );

    expect(withGaps).toContain(TWO_GAPS);
    expect(without).not.toContain("no recording");
  });

  it("says it once under the variability charts", () => {
    const withGaps = renderToStaticMarkup(
      createElement(VariabilityChart, { data: rows(variability, HOLE) })
    );
    const without = renderToStaticMarkup(
      createElement(VariabilityChart, { data: rows(variability, []) })
    );

    expect(count(withGaps, TWO_GAPS)).toBe(1);
    expect(without).not.toContain("no recording");
  });

  it("says it once under the within-night charts", () => {
    const withGaps = renderToStaticMarkup(
      createElement(WithinNightChart, { data: rows(withinNight, HOLE) })
    );
    const without = renderToStaticMarkup(
      createElement(WithinNightChart, { data: rows(withinNight, []) })
    );

    expect(count(withGaps, TWO_GAPS)).toBe(1);
    expect(without).not.toContain("no recording");
  });

  it("says it under each of the activity and recovery charts", () => {
    const withGaps = renderToStaticMarkup(
      createElement(ActivityRecoveryChart, { data: rows(activity, HOLE) })
    );
    const without = renderToStaticMarkup(
      createElement(ActivityRecoveryChart, { data: rows(activity, []) })
    );

    expect(count(withGaps, TWO_GAPS)).toBe(2);
    expect(without).not.toContain("no recording");
  });

  it("keeps the gap note out of a chart that has nothing to show", () => {
    const html = renderToStaticMarkup(
      createElement(CircadianChart, { data: rows(circadian, DAYS) })
    );

    expect(html).toContain("No eligible circadian metric");
    expect(html).not.toContain("no recording");
  });

  it("answers a hover over a missing night in words, in every tooltip", () => {
    const gap = "2026-10-02";
    const markup = [
      renderToStaticMarkup(
        createElement(CircadianTooltipContent, {
          active: true,
          payload: [{ payload: circadian(gap, true) }],
        })
      ),
      renderToStaticMarkup(
        createElement(VariabilityTooltipContent, {
          active: true,
          mode: "sleep",
          payload: [{ payload: variability(gap, true) }],
        })
      ),
      renderToStaticMarkup(
        createElement(VariabilityTooltipContent, {
          active: true,
          mode: "clock",
          payload: [{ payload: variability(gap, true) }],
        })
      ),
      renderToStaticMarkup(
        createElement(WithinNightTooltipContent, {
          active: true,
          mode: "cv",
          payload: [{ payload: withinNight(gap, true) }],
        })
      ),
      renderToStaticMarkup(
        createElement(WithinNightTooltipContent, {
          active: true,
          mode: "fragmentation",
          payload: [{ payload: withinNight(gap, true) }],
        })
      ),
      renderToStaticMarkup(
        createElement(ActivityTooltipContent, {
          active: true,
          payload: [{ payload: activity(gap, true) }],
        })
      ),
      renderToStaticMarkup(
        createElement(StressTooltipContent, {
          active: true,
          payload: [{ payload: activity(gap, true) }],
        })
      ),
    ];

    for (const html of markup) {
      expect(words(html)).toBe("2026-10-02 No night recorded");
    }
  });

  it("opens no tooltip over a recorded night that has nothing to show in a chart", () => {
    const html = renderToStaticMarkup(
      createElement(CircadianTooltipContent, {
        active: true,
        payload: [
          {
            value: null,
            payload: { day: "2026-10-01", is: null, iv: null, ra: null },
          },
        ],
      })
    );

    expect(html).toBe("");
  });

  it("still gives the values of a recorded night", () => {
    const circadianHtml = renderToStaticMarkup(
      createElement(CircadianTooltipContent, {
        active: true,
        payload: [{ value: 0.7, payload: circadian("2026-10-01") }],
      })
    );
    const activityHtml = renderToStaticMarkup(
      createElement(ActivityTooltipContent, {
        active: true,
        payload: [{ value: 8000, payload: activity("2026-10-01") }],
      })
    );

    expect(circadianHtml).toContain("0.700");
    expect(activityHtml).toContain("8,000");
    expect(circadianHtml + activityHtml).not.toContain("No night recorded");
  });
});
