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
      })
    );

    expect(html).toContain("Personal mood scale");
    expect(html).not.toContain("NIMH");
    expect(html).toContain("0 = personal rolling baseline");
    expect(html).toContain("±2 = unusual");
    expect(html).toContain("not inherently good or");
    expect(html).toContain("compare sustained changes with your own history");
  });
});
