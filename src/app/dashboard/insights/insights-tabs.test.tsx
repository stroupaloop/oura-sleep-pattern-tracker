import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InsightsTabs } from "./insights-tabs";

type Props = ComponentProps<typeof InsightsTabs>;

const RANGE = { start: "2026-09-30", end: "2026-10-06" };

function renderEmpty() {
  return renderToStaticMarkup(
    createElement(InsightsTabs, {
      analysis: [],
      episodes: [],
      workouts: [],
      moods: [],
      range: RANGE,
      nightDays: [],
    })
  );
}

function analysed(day: string): Props["analysis"][number] {
  return {
    day,
    circadianIS: 0.7,
    circadianIV: 0.1,
    circadianRA: 0.55,
    steps: 8000,
    activeMinutes: 45,
    stressHigh: 3600,
    recoveryHigh: 5400,
    resilienceLevel: "solid",
    dayToDaySleepCV: 0.08,
    dayToDayBedtimeCV: 0.01,
    dayToDayWakeCV: 0.012,
    withinNightHrvCV: 0.25,
    withinNightHrCV: 0.08,
    hypnogramFragmentation: 0.2,
    avgHrv: 42,
    efficiency: 90,
    deepPct: 18,
    anomalyScore: 0.3,
    anomalyDirection: null,
    isAnomaly: 0,
    totalSleepMinutes: 420,
    moodScore: null,
    energyScore: null,
    irritabilityScore: null,
    anxietyScore: null,
  };
}

function renderDays(
  analysedDays: string[],
  nightDays: string[],
  range = RANGE
) {
  return renderToStaticMarkup(
    createElement(InsightsTabs, {
      analysis: analysedDays.map(analysed),
      episodes: [],
      workouts: [],
      moods: [],
      range,
      nightDays,
    })
  );
}

describe("InsightsTabs context", () => {
  it("uses relationships language and an informative default empty state", () => {
    const html = renderEmpty();

    expect(html).toContain("Relationships");
    expect(html).toContain("No eligible circadian metric");
  });

  it("exposes the sections as tabs with only the selected panel shown", () => {
    const html = renderEmpty();

    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(5);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/id="insights-tab-circadian"[^>]*aria-selected="true"/);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(5);
    expect(html.match(/role="tabpanel"[^>]*hidden=""/g)).toHaveLength(4);
  });
});

describe("InsightsTabs missing nights", () => {
  it("counts each day in the window with no night as a gap", () => {
    const html = renderDays(
      ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"],
      ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06"]
    );

    expect(html).toContain("2 nights have no recording and appear as gaps.");
  });

  it("does not call a night with no analysis yet a gap", () => {
    const html = renderDays(
      ["2026-10-01", "2026-10-05", "2026-10-06"],
      ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06"]
    );

    expect(html).toContain("1 night has no recording and appears as a gap.");
  });

  it("runs the window to today, so a newest night that is missing shows", () => {
    const html = renderDays(
      ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"],
      ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]
    );

    expect(html).toContain("2 nights have no recording and appear as gaps.");
  });

  it("leaves the days before the first analysed night off", () => {
    const html = renderDays(
      ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"],
      ["2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]
    );

    expect(html).not.toContain("no recording");
  });

  it("says nothing when every night in the window is there", () => {
    const days = [
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ];

    expect(renderDays(days, days)).not.toContain("no recording");
  });
});
