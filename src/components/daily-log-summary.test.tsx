import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailyLogSummary } from "./daily-log-summary";

const MEDS = [
  { id: 1, name: "Lamotrigine", dosage: null, frequency: "daily", doseSchedule: '["morning"]', startDate: null, endDate: null },
  { id: 2, name: "Lithium", dosage: null, frequency: "daily", doseSchedule: '["evening"]', startDate: null, endDate: null },
];

describe("DailyLogSummary", () => {
  it("summarises the day's log without showing the note itself", () => {
    const html = renderToStaticMarkup(
      <DailyLogSummary
        day="2026-09-27"
        mood={{
          moodScore: 2,
          episodeState: "depressive",
          tags: '["poor_sleep"]',
          notes: "private words",
        }}
        medications={MEDS}
        medLogs={[{ medicationId: 1, slot: "morning", taken: 1 }]}
      />
    );
    expect(html).toContain("+2");
    expect(html).toContain("Depressive");
    expect(html).toContain("Lamotrigine (Morning)");
    expect(html).toContain("Lithium (Evening)");
    expect(html).toContain("poor sleep");
    expect(html).toContain("Added");
    expect(html).not.toContain("private words");
  });

  it("says when nothing has been logged yet", () => {
    const html = renderToStaticMarkup(
      <DailyLogSummary day="2026-09-27" mood={null} medications={MEDS} medLogs={[]} />
    );
    expect(html).toContain("Not logged yet");
    expect(html).toContain("None marked");
    expect(html).not.toContain("Episode");
  });
});
