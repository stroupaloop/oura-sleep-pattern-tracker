import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScoreSlider } from "./score-slider";

function render(value: number | null, disabled = false) {
  return renderToStaticMarkup(
    <ScoreSlider
      label="Energy"
      low="Low"
      high="High"
      value={value}
      onChange={() => {}}
      disabled={disabled}
    />
  );
}

function inputTag(html: string) {
  return html.match(/<input[^>]*>/)?.[0] ?? "";
}

describe("ScoreSlider", () => {
  it("reads Not set, with nothing to clear, until it is answered", () => {
    const html = render(null);
    expect(html).toContain(">Not set<");
    expect(html).not.toMatch(/\d\/5/);
    expect(html).not.toContain("Clear");
    expect(inputTag(html)).toContain('aria-valuetext="Not set"');
  });

  it("rests an unset slider at 3 in a muted tone, not the answer's rose", () => {
    const tag = inputTag(render(null));
    expect(tag).toContain('value="3"');
    expect(tag).toContain("accent-muted-foreground");
    expect(tag).not.toContain("accent-primary");
  });

  it("shows the answer out of 5 and offers Clear, named for its slider", () => {
    const html = render(4);
    expect(html).toContain(">4/5<");
    expect(html).not.toContain("Not set");
    expect(inputTag(html)).toContain('value="4"');
    expect(inputTag(html)).toContain('aria-valuetext="4 of 5"');
    expect(inputTag(html)).toContain("accent-primary");
    expect(html).toMatch(
      /<button[^>]*aria-label="Clear energy"[^>]*>Clear<\/button>/
    );
  });

  it("shows an answer of 3 as an answer, not as the resting position", () => {
    const html = render(3);
    expect(html).toContain(">3/5<");
    expect(html).not.toContain("Not set");
    expect(html).toContain("Clear");
    expect(inputTag(html)).toContain("accent-primary");
  });

  it("puts what 1 and 5 mean at the ends of the track", () => {
    const html = render(null);
    const low = html.indexOf(">Low<");
    const track = html.indexOf("<input");
    const high = html.indexOf(">High<");
    expect(low).toBeGreaterThan(-1);
    expect(low).toBeLessThan(track);
    expect(track).toBeLessThan(high);
  });

  it("names the slider with its visible label", () => {
    const html = render(null);
    const id = html.match(/<label for="([^"]+)"[^>]*>Energy<\/label>/)?.[1];
    expect(id).toBeTruthy();
    expect(inputTag(html)).toContain(`id="${id}"`);
  });

  it("keeps phone-sized targets and tabular numerals", () => {
    const html = render(4);
    expect(inputTag(html)).toMatch(/class="[^"]*\bh-10\b/);
    expect(html).toMatch(
      /<button[^>]*class="[^"]*\bh-10\b[^"]*"[^>]*>Clear<\/button>/
    );
    expect(html).toMatch(/class="[^"]*\btabular-nums\b[^"]*">4\/5</);
  });

  it("disables the slider and Clear together while a day loads", () => {
    const html = render(4, true);
    expect(inputTag(html)).toContain('disabled=""');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Clear<\/button>/);
    expect(inputTag(render(4))).not.toContain("disabled");
  });
});
