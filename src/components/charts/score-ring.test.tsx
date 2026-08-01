import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScoreRing } from "./score-ring";

describe("ScoreRing", () => {
  it("exposes the Oura category and meter value without relying on color", () => {
    const html = renderToStaticMarkup(
      createElement(ScoreRing, {
        score: 86,
        label: "Sleep Score",
        sublabel: "Jul 31, 2026",
      })
    );

    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="86"');
    expect(html).toContain('aria-valuetext="86 out of 100, Optimal"');
    expect(html).toContain("Optimal");
  });

  it("describes a missing score explicitly", () => {
    const html = renderToStaticMarkup(
      createElement(ScoreRing, { score: null, label: "Readiness" })
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-valuetext="No score available"');
    expect(html).not.toContain('role="meter"');
    expect(html).not.toContain("aria-valuemin");
    expect(html).not.toContain("Pay Attention");
  });
});
