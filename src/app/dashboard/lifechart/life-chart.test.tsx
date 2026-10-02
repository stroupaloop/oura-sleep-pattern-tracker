import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LifeChart } from "./life-chart";

describe("LifeChart context", () => {
  it("defines the mood and personal-baseline z-score scales", () => {
    const html = renderToStaticMarkup(
      createElement(LifeChart, {
        analysis: [],
        moods: [],
        episodes: [],
        threshold: 1.5,
      })
    );

    expect(html).toContain("Personal mood scale");
    expect(html).not.toContain("NIMH");
    expect(html).toContain("0 = personal rolling baseline");
    expect(html).toContain("usual range (±1)");
    expect(html).toContain("±1.5 or more = unusual");
    expect(html).not.toContain("±2");
    expect(html).toContain("not inherently good or");
    expect(html).toContain("compare sustained changes with your own history");
  });

  it("says each flagged or tagged day in words, not only in color", () => {
    const html = renderToStaticMarkup(
      createElement(LifeChart, {
        analysis: [],
        moods: [
          {
            day: "2026-07-29",
            moodScore: 1,
            energyScore: null,
            irritabilityScore: null,
            anxietyScore: null,
            tags: JSON.stringify(["travel"]),
            notes: null,
            episodeState: null,
          },
        ],
        episodes: [{ day: "2026-07-30", tier: "warning", direction: "hyper" }],
        threshold: 1.5,
      })
    );

    expect(html).toContain("Jul 29, 2026 · Tags: travel");
    expect(html).toContain("Jul 30, 2026 · Warning pattern flag");
    expect(html).toContain("Pattern flags and tags by day");
  });
});
