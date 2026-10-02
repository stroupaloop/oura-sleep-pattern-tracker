import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EpisodeTimeline } from "./episode-timeline";

describe("EpisodeTimeline", () => {
  const html = renderToStaticMarkup(
    createElement(EpisodeTimeline, {
      episodes: [
        {
          day: "2026-07-30",
          tier: "watch",
          direction: "hypo",
          confidence: 2.4,
          primaryDrivers: null,
        },
      ],
      selfReports: [{ day: "2026-07-30", episodeState: "depressive" }],
      thresholds: { watch: 2, warning: 3.5, alert: 5 },
    })
  );

  it("names tiers, directions and self-reports in words", () => {
    for (const word of ["Watch", "Warning", "Alert", "No flag"]) {
      expect(html).toContain(word);
    }
    expect(html).toContain("lower activation");
    expect(html).toContain("Markers along the baseline are optional self-reports");
    for (const state of ["Depressive", "Hypomanic", "Manic", "Mixed"]) {
      expect(html).toContain(state);
    }
  });

  it("never names a color in its legend", () => {
    expect(html).not.toMatch(/\b(blue|amber|purple|red|green)\b/i);
  });
});
