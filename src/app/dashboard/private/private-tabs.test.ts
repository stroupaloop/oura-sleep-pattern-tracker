import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getCycleEvaluationResultLabel,
  getCycleSecondaryChartVisibility,
  getPrivateTabIndexForKey,
  PrivateTabs,
} from "./private-tabs";

const emptyPrivateData = {
  currentDay: "2026-08-01",
  cvAgeData: [],
  vo2Data: [],
  personalInfo: null,
  cycleEvaluation: {
    state: "insufficient_data" as const,
    outcome: "insufficient_data" as const,
    cycles: [],
    checkedThroughDay: "2026-08-01",
    latestTemperatureDay: null,
    eligibleTemperatureDays: 0,
    longestEligibleTemperatureRun: 0,
    currentEligibleTemperatureRun: 0,
    restModeExcludedTemperatureDays: 0,
    restModeActive: false,
    restModeCoverageLimited: false,
    insufficientReason: "no_temperature_data" as const,
  },
  temperatureData: [],
  bedtimeData: [],
  hrData: [],
  hourlyHrData: [],
  healthSignals: [],
  cyclePhaseDaily: [],
  wearActivityData: [],
  wearActivityHrData: [],
  sourceFreshness: {
    sleep: { state: "unknown" as const, attemptedAt: null, lastSourceDay: null },
    cardiovascularAge: {
      state: "unknown" as const,
      attemptedAt: null,
      lastSourceDay: null,
    },
    vo2Max: {
      state: "unknown" as const,
      attemptedAt: null,
      lastSourceDay: null,
    },
    bedtimeGuidance: {
      state: "unknown" as const,
      attemptedAt: null,
      lastSourceDay: null,
    },
  },
};

describe("Private tab keyboard navigation", () => {
  it("moves between tabs and wraps at each end", () => {
    expect(getPrivateTabIndexForKey("ArrowRight", 1, 5)).toBe(2);
    expect(getPrivateTabIndexForKey("ArrowRight", 4, 5)).toBe(0);
    expect(getPrivateTabIndexForKey("ArrowLeft", 1, 5)).toBe(0);
    expect(getPrivateTabIndexForKey("ArrowLeft", 0, 5)).toBe(4);
  });

  it("supports first and last tab shortcuts", () => {
    expect(getPrivateTabIndexForKey("Home", 3, 5)).toBe(0);
    expect(getPrivateTabIndexForKey("End", 1, 5)).toBe(4);
  });

  it("leaves unrelated keys to their default behavior", () => {
    expect(getPrivateTabIndexForKey("Tab", 2, 5)).toBeNull();
    expect(getPrivateTabIndexForKey("Enter", 2, 5)).toBeNull();
  });

  it("links each tab to a labelled panel and exposes one selected tab", () => {
    const html = renderToStaticMarkup(
      createElement(PrivateTabs, emptyPrivateData)
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Private data sections"');
    expect(html).toContain('id="private-tab-overview"');
    expect(html).toContain('aria-controls="private-panel-overview"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('id="private-panel-overview"');
    expect(html).toContain('aria-labelledby="private-tab-overview"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toContain("Cycle Context");
  });
});

describe("Cycle Context presentation", () => {
  it("distinguishes a checked zero-shift result from insufficient data", () => {
    expect(
      getCycleEvaluationResultLabel({
        ...emptyPrivateData.cycleEvaluation,
        state: "complete",
        outcome: "no_shifts",
        latestTemperatureDay: "2026-08-01",
        eligibleTemperatureDays: 90,
        longestEligibleTemperatureRun: 90,
        currentEligibleTemperatureRun: 90,
        insufficientReason: null,
      })
    ).toBe("No qualifying thermal shifts");
    expect(
      getCycleEvaluationResultLabel(emptyPrivateData.cycleEvaluation)
    ).toBe("Insufficient consecutive temperature data");
  });

  it("gates secondary charts until they have enough observations", () => {
    expect(getCycleSecondaryChartVisibility(1, 0)).toEqual({
      phaseWindows: false,
      calendar: false,
      intervals: false,
    });
    expect(getCycleSecondaryChartVisibility(2, 1)).toEqual({
      phaseWindows: true,
      calendar: true,
      intervals: false,
    });
    expect(getCycleSecondaryChartVisibility(4, 3)).toEqual({
      phaseWindows: true,
      calendar: true,
      intervals: true,
    });
  });
});
