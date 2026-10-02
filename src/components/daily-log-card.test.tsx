import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DailyLogCard } from "./daily-log-card";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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

function moodButton(html: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(
    new RegExp(`<button[^>]*aria-label="${escaped}"[^>]*>([^<]*)</button>`)
  );
}

describe("DailyLogCard", () => {
  it("names each mood by its signed value and presses only the chosen one", () => {
    for (const html of [render(false), render(true)]) {
      expect(html.match(/aria-label="[−+]?\d: [^"]+"/g)).toEqual([
        'aria-label="−3: Very low"',
        'aria-label="−2: Low"',
        'aria-label="−1: Slightly low"',
        'aria-label="0: Neutral"',
        'aria-label="+1: Slightly high"',
        'aria-label="+2: High"',
        'aria-label="+3: Very high"',
      ]);
      const chosen = moodButton(html, "+2: High");
      expect(chosen?.[0]).toContain('aria-pressed="true"');
      expect(chosen?.[1]).toBe("+2");
      const other = moodButton(html, "−2: Low");
      expect(other?.[0]).toContain('aria-pressed="false"');
      expect(other?.[1]).toBe("−2");
    }
  });

  it("keeps the mood ramp to a mark under each button, never behind the number", () => {
    const html = render(true);
    for (const label of ["−3: Very low", "0: Neutral", "+3: Very high"]) {
      expect(moodButton(html, label)?.[0]).not.toContain("bg-level-");
    }
    expect(
      html.match(/<span aria-hidden="true" class="[^"]*bg-level-\d/g)
    ).toHaveLength(7);
  });

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
