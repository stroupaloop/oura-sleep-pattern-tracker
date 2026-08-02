import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildCyclePhaseSummary,
  CyclePhaseChart,
} from "./cycle-phase-chart";

interface TestPoint {
  day: string;
  sleepHours: number | null;
  efficiency: number | null;
  avgHrv: number | null;
  moodScore: number | null;
  temperatureDelta: number | null;
}

function point(
  day: string,
  overrides: Partial<Omit<TestPoint, "day">> = {}
): TestPoint {
  return {
    day,
    sleepHours: 7,
    efficiency: 85,
    avgHrv: 40,
    moodScore: 0,
    temperatureDelta: 0.1,
    ...overrides,
  };
}

describe("CyclePhaseChart evidence gates", () => {
  it("does not render from a single detected shift", () => {
    const html = renderToStaticMarkup(
      createElement(CyclePhaseChart, {
        dailyData: [point("2026-01-31"), point("2026-02-01")],
        thermalShiftDays: ["2026-02-01"],
      })
    );

    expect(html).toBe("");
  });

  it("does not render averages without enough daily observations", () => {
    const html = renderToStaticMarkup(
      createElement(CyclePhaseChart, {
        dailyData: [
          point("2026-01-31"),
          point("2026-02-01"),
          point("2026-02-04"),
        ],
        thermalShiftDays: ["2026-02-01", "2026-03-01"],
      })
    );

    expect(html).toBe("");
  });

  it("surfaces shift and daily sample counts when evidence is sufficient", () => {
    const html = renderToStaticMarkup(
      createElement(CyclePhaseChart, {
        dailyData: [
          point("2026-01-25"),
          point("2026-01-26"),
          point("2026-01-27"),
          point("2026-02-01"),
          point("2026-02-02"),
          point("2026-02-03"),
          point("2026-02-22"),
          point("2026-02-23"),
          point("2026-02-24"),
          point("2026-03-01"),
          point("2026-03-02"),
          point("2026-03-03"),
        ],
        thermalShiftDays: ["2026-02-01", "2026-03-01"],
      })
    );

    expect(html).toContain("2 detected shifts contribute");
    expect(html).toContain("2 shifts · 6 nights");
    expect(html).toContain("not physiological phases or fertility guidance");
  });

  it("averages within each shift first and requires two distinct shifts per metric and window", () => {
    const firstShiftDays = [
      "2026-01-25",
      "2026-01-26",
      "2026-01-27",
      "2026-02-01",
      "2026-02-02",
      "2026-02-03",
    ];
    const secondShiftDays = [
      "2026-02-22",
      "2026-02-23",
      "2026-02-24",
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
    ];
    const summary = buildCyclePhaseSummary(
      [
        ...firstShiftDays.map((day) =>
          point(day, { sleepHours: 6, moodScore: 1 })
        ),
        ...secondShiftDays.map((day) =>
          point(day, { sleepHours: 8, moodScore: null })
        ),
      ],
      ["2026-02-01", "2026-03-01"]
    );

    expect(summary.contributingShiftCount).toBe(2);
    expect(summary.data[0].sleepHours).toBe(7);
    expect(summary.data[0].counts.sleep).toEqual({
      shifts: 2,
      nights: 6,
    });
    expect(summary.data[0].moodScore).toBeNull();
    expect(summary.data[0].counts.mood).toEqual({
      shifts: 0,
      nights: 0,
    });
  });
});
