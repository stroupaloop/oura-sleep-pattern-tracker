import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EpisodePatternBanner } from "./episode-pattern-banner";

describe("EpisodePatternBanner", () => {
  it("shows the tier, the flagged-day count and the direction", () => {
    const html = renderToStaticMarkup(
      <EpisodePatternBanner tier="warning" direction="hyper" flaggedDays={3} />
    );
    expect(html).toContain("WARNING");
    expect(html).toContain("3 flagged days in the last 14 days");
    expect(html).toContain("Higher-activation personal-baseline pattern");
  });

  it("uses the singular for one flagged day", () => {
    const html = renderToStaticMarkup(
      <EpisodePatternBanner tier="watch" direction="hypo" flaggedDays={1} />
    );
    expect(html).toContain("1 flagged day in the last 14 days");
    expect(html).toContain("Lower-activation");
  });
});
