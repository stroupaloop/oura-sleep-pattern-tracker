import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailyLogSummary } from "./daily-log-summary";

const MEDS = [
  { id: 1, name: "Lamotrigine", dosage: null, frequency: "daily", doseSchedule: '["morning"]', startDate: null, endDate: null },
  { id: 2, name: "Lithium", dosage: null, frequency: "daily", doseSchedule: '["evening"]', startDate: null, endDate: null },
];

const MOOD = {
  moodScore: 2,
  episodeState: "depressive",
  energyScore: 4,
  irritabilityScore: null,
  anxietyScore: null,
  sleepSubjective: 2,
  tags: '["poor_sleep"]',
  notes: "I watched the movie\nand thought of us",
};

describe("DailyLogSummary", () => {
  it("shows the whole log, note included", () => {
    const html = renderToStaticMarkup(
      <DailyLogSummary
        day="2026-09-27"
        mood={MOOD}
        medications={MEDS}
        medLogs={[{ medicationId: 1, slot: "morning", taken: 1 }]}
      />
    );
    expect(html).toContain("+2");
    expect(html).toContain("Depressive");
    expect(html).toContain("Energy 4/5 · Sleep quality 2/5");
    expect(html).toContain("I watched the movie\nand thought of us");
    expect(html).toContain("Lamotrigine (Morning)");
    expect(html).toContain("Lithium (Evening)");
    expect(html).toContain("poor sleep");
  });

  it("escapes the note rather than rendering it as markup", () => {
    const html = renderToStaticMarkup(
      <DailyLogSummary
        day="2026-09-27"
        mood={{ ...MOOD, notes: "<script>alert(1)</script>" }}
        medications={MEDS}
        medLogs={[]}
      />
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("says when nothing has been logged yet", () => {
    const html = renderToStaticMarkup(
      <DailyLogSummary day="2026-09-27" mood={null} medications={MEDS} medLogs={[]} />
    );
    expect(html).toContain("Not logged yet");
    expect(html).toContain("None marked");
    expect(html).not.toContain("Episode");
    expect(html).not.toContain("Note");
  });
});
