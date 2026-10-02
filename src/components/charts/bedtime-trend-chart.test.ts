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

describe("BedtimeTrendChart window", () => {
  it("places each bedtime against Oura's suggested window in words, without grading it", () => {
    const html = renderToStaticMarkup(
      createElement(BedtimeTrendChart, {
        data: [
          { day: "2026-07-29", actualBedtime: 1380, optimalStart: 1365, optimalEnd: 1425 },
          { day: "2026-07-30", actualBedtime: 1470, optimalStart: 1365, optimalEnd: 1425 },
          { day: "2026-07-31", actualBedtime: 1400, optimalStart: null, optimalEnd: null },
        ],
      })
    ).replaceAll("&#x27;", "'");

    expect(html).toContain(
      "2026-07-29: Oura-detected bedtime 11:00 PM; Inside Oura's suggested window"
    );
    expect(html).toContain(
      "2026-07-30: Oura-detected bedtime 12:30 AM; Outside Oura's suggested window by 45m"
    );
    expect(html).toContain(
      "2026-07-31: Oura-detected bedtime 11:20 PM; Oura's suggested window unavailable"
    );
    expect(html).not.toMatch(/optimal/i);
  });
});
