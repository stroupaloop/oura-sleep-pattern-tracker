import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getPrivateTabIndexForKey, PrivateTabs } from "./private-tabs";

const emptyPrivateData = {
  currentDay: "2026-08-01",
  cvAgeData: [],
  vo2Data: [],
  personalInfo: null,
  cycleData: [],
  temperatureData: [],
  eligibleTemperatureRun: 0,
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
  });
});
