import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MoodForm } from "./mood-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const MOOD = {
  moodScore: -1,
  energyScore: null,
  irritabilityScore: null,
  anxietyScore: null,
  sleepSubjective: null,
  notes: null,
  tags: '["travel"]',
  episodeState: "none",
  createdAt: null,
};

function render() {
  return renderToStaticMarkup(
    <MoodForm
      initialDay="2026-01-15"
      existingMood={MOOD}
      medications={[]}
      existingMedLogs={[]}
      episodePattern={null}
    />
  );
}

function buttonFor(html: string, attribute: string) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<button[^>]*${escaped}[^>]*>([^<]*)</button>`));
}

describe("MoodForm", () => {
  it("names each mood by its signed value and presses only the chosen one", () => {
    const html = render();
    expect(html).toContain("from −3 to +3");
    expect(html.match(/aria-label="[−+]?\d: [^"]+"/g)).toHaveLength(7);
    const chosen = buttonFor(html, 'aria-label="−1: Slightly low"');
    expect(chosen?.[0]).toContain('aria-pressed="true"');
    expect(chosen?.[1]).toBe("−1");
    expect(buttonFor(html, 'aria-label="+1: Slightly high"')?.[0]).toContain(
      'aria-pressed="false"'
    );
    expect(html).toContain(">Slightly low<");
  });

  it("offers episode states and tags as pressed toggles", () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>None<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>travel<\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*>illness<\/button>/);
  });

  it("keeps the optional details in a closed disclosure", () => {
    const html = render();
    expect(html).toMatch(/<details(?![^>]*\bopen\b)[^>]*>\s*<summary/);
    expect(html).toContain("Show optional details");
  });

  it("names the day in words, never as a raw date", () => {
    const html = render();
    expect(html).toContain("How were you feeling on Thu, Jan 15?");
    expect(html).not.toMatch(/>[^<]*\d{4}-\d{2}-\d{2}[^<]*</);
  });
});
