import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatMoodValue } from "@/lib/design/mood-scale";
import type { ReportData } from "@/lib/reports/generate";
import { ReportView } from "./report-view";

const MINUS_3 = formatMoodValue(-3);
const MINUS_2 = formatMoodValue(-2);

function report(
  summary: Partial<ReportData["summary"]> = {},
  trends: Partial<ReportData["trends"]> = {}
): ReportData {
  return {
    dateRange: { start: "2026-09-01", end: "2026-09-30" },
    summary: {
      totalDays: 30,
      avgSleepHours: 6.7,
      avgHrv: 52,
      avgSteps: 7800,
      sleepDays: 27,
      hrvDays: 27,
      stepDays: 29,
      moodEntries: 20,
      avgMood: 0,
      moodMin: -3,
      moodMax: 3,
      moodHighDays: 10,
      moodLowDays: 10,
      ...summary,
    },
    trends: { sleepTrend: "stable", hrvTrend: "stable", ...trends },
    episodes: [],
    medicationAdherence: [],
    dataCompleteness: {
      ouraDays: 29,
      moodDays: 20,
      totalDays: 30,
      ouraRate: 29 / 30,
      moodRate: 20 / 30,
    },
  };
}

function render(data: ReportData): string {
  return renderToStaticMarkup(<ReportView data={data} />)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

describe("ReportView mood summary", () => {
  it("shows the range and extreme-day counts beside an average of zero for a +3/-3 cycle", () => {
    const text = render(report());

    expect(text).toContain("Avg Mood 0 mean of daily ratings");
    expect(text).not.toMatch(/Avg Mood 0\.\d/);
    expect(text).toContain(`Mood Range ${MINUS_3} to +3 lowest to highest logged`);
    expect(text).toContain("Days at +2 or above 10 of 20 logged days");
    expect(text).toContain(`Days at ${MINUS_2} or below 10 of 20 logged days`);
  });

  it("gives the mood entries a denominator", () => {
    expect(render(report())).toContain("Mood Entries 20 of 30 days");
  });

  it("shows a single value when every logged mood is the same", () => {
    const text = render(
      report({
        moodEntries: 1,
        avgMood: 1,
        moodMin: 1,
        moodMax: 1,
        moodHighDays: 0,
        moodLowDays: 0,
      })
    );

    expect(text).toContain("Mood Range +1 lowest to highest logged");
    expect(text).toContain("Days at +2 or above 0 of 1 logged day");
  });

  it("leaves the mood statistics out when nothing was logged", () => {
    const text = render(
      report({
        moodEntries: 0,
        avgMood: null,
        moodMin: null,
        moodMax: null,
        moodHighDays: 0,
        moodLowDays: 0,
      })
    );

    expect(text).toContain("Mood Entries 0 of 30 days");
    expect(text).not.toContain("Mood Range");
    expect(text).not.toContain("Avg Mood");
    expect(text).not.toContain("Days at");
  });
});

describe("ReportView trends", () => {
  it("says no clear change instead of steady when the test finds nothing", () => {
    const text = render(report());

    expect(text).toContain("27 measured nights · no clear change");
    expect(text).not.toMatch(/steady/i);
  });

  it("names a rise or fall across the window in words", () => {
    const text = render(
      report({}, { sleepTrend: "decreasing", hrvTrend: "increasing" })
    );

    expect(text).toContain("27 measured nights · falling across the window");
    expect(text).toContain("27 measured nights · rising across the window");
  });

  it("says why a trend is missing when there are too few nights", () => {
    const text = render(
      report({ sleepDays: 5 }, { sleepTrend: "insufficient_data" })
    );

    expect(text).toContain(
      "5 measured nights · Trend unavailable: fewer than 7 measured nights"
    );
  });

  it("states how an arrow is decided", () => {
    const text = render(report());

    expect(text).toContain("Mann-Kendall");
    expect(text).toContain("5% of their typical value");
    expect(text).toContain("does not mean nothing changed");
  });
});
