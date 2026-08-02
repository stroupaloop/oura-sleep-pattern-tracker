import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InsightsTabs } from "./insights-tabs";

describe("InsightsTabs context", () => {
  it("uses relationships language and an informative default empty state", () => {
    const html = renderToStaticMarkup(
      createElement(InsightsTabs, {
        analysis: [],
        episodes: [],
        workouts: [],
        moods: [],
      })
    );

    expect(html).toContain("Relationships");
    expect(html).toContain("No eligible circadian metric");
  });
});
