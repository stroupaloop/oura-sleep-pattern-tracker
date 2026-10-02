import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InsightsTabs } from "./insights-tabs";

function renderEmpty() {
  return renderToStaticMarkup(
    createElement(InsightsTabs, {
      analysis: [],
      episodes: [],
      workouts: [],
      moods: [],
    })
  );
}

describe("InsightsTabs context", () => {
  it("uses relationships language and an informative default empty state", () => {
    const html = renderEmpty();

    expect(html).toContain("Relationships");
    expect(html).toContain("No eligible circadian metric");
  });

  it("exposes the sections as tabs with only the selected panel shown", () => {
    const html = renderEmpty();

    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(5);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/id="insights-tab-circadian"[^>]*aria-selected="true"/);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(5);
    expect(html.match(/role="tabpanel"[^>]*hidden=""/g)).toHaveLength(4);
  });
});
