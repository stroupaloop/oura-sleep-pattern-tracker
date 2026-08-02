import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CycleTemperatureChart } from "./cycle-temperature-chart";

describe("CycleTemperatureChart context", () => {
  it("states the personal baseline and measured-night count", () => {
    const html = renderToStaticMarkup(
      createElement(CycleTemperatureChart, {
        data: [
          {
            day: "2026-07-30",
            temperatureDelta: 0.1,
            restModeExcluded: false,
          },
          {
            day: "2026-07-31",
            temperatureDelta: null,
            restModeExcluded: false,
          },
          {
            day: "2026-08-01",
            temperatureDelta: -0.1,
            restModeExcluded: true,
          },
        ],
      })
    );

    expect(html).toContain("2 measured nights");
    expect(html).toContain("0°C is your Oura personal baseline");
    expect(html).toContain("not inherently good or bad");
    expect(html).toContain("1 excluded by recorded Rest Mode");
    expect(html).toContain("Missing and excluded nights break the line");
  });
});
