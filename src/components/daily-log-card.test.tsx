import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DailyLogCard } from "./daily-log-card";

const MEDS = [
  { id: 1, name: "Linzess", dosage: "290mcg", frequency: "daily", doseSchedule: '["morning"]', startDate: null, endDate: null },
];
const MOOD = { moodScore: 2, episodeState: "depressive", tags: null, notes: "hello" };

function render(dense: boolean) {
  return renderToStaticMarkup(
    <DailyLogCard
      initialDay="2026-09-27"
      medications={MEDS}
      initialMood={MOOD}
      initialMedLogs={[]}
      dense={dense}
    />
  );
}

describe("DailyLogCard", () => {
  it("keeps notes between episode state and tags in both layouts", () => {
    for (const html of [render(false), render(true)]) {
      const episode = html.indexOf(">Episode state<");
      const notes = html.indexOf(">Notes<");
      const tags = html.indexOf(">Tags<");
      expect(episode).toBeGreaterThan(-1);
      expect(episode).toBeLessThan(notes);
      expect(notes).toBeLessThan(tags);
    }
  });

  it("names the chosen mood in the heading and lists doses inline when dense", () => {
    const html = render(true);
    expect(html).toContain(" · High");
    expect(html).toContain('title="290mcg"');
  });
});
