import { describe, expect, it } from "vitest";
import { collectLifeChartDays } from "./life-chart";

describe("Life Chart day coverage", () => {
  it("includes analysis, mood-only, and episode-only days in order", () => {
    expect(
      collectLifeChartDays(
        [{ day: "2026-07-28" }, { day: "2026-07-30" }],
        [{ day: "2026-07-29" }, { day: "2026-07-30" }],
        [{ day: "2026-07-27" }]
      )
    ).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
    ]);
  });
});
