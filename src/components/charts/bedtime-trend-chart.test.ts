import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BedtimeTrendChart } from "./bedtime-trend-chart";

describe("BedtimeTrendChart empty state", () => {
  it("renders an actionable card when stored rows have no usable bedtime", () => {
    const html = renderToStaticMarkup(
      createElement(BedtimeTrendChart, {
        data: [
          {
            day: "2026-07-31",
            actualBedtime: null,
            optimalStart: null,
            optimalEnd: null,
          },
        ],
      })
    );

    expect(html).toContain("Sleep Timing");
    expect(html).toContain(
      "No Oura-detected bedtime is available for this range."
    );
    expect(html).toContain('href="/dashboard/settings"');
  });
});
