import { describe, expect, it } from "vitest";
import {
  collectLifeChartDays,
  getLifeChartStartDay,
  resolveLifeChartRange,
} from "./life-chart";

describe("Life Chart range", () => {
  it("uses an inclusive start day for the selected number of days", () => {
    expect(getLifeChartStartDay("2026-07-30", 30)).toBe("2026-07-01");
    expect(getLifeChartStartDay("2026-07-30", 90)).toBe("2026-05-02");
  });

  it("accepts supported ranges and falls back for invalid values", () => {
    expect(resolveLifeChartRange("365")).toBe(365);
    expect(resolveLifeChartRange("31")).toBe(90);
    expect(resolveLifeChartRange(undefined)).toBe(90);
  });

  it("rejects a non-positive range", () => {
    expect(() => getLifeChartStartDay("2026-07-30", 0)).toThrow(
      "Invalid Life Chart date range"
    );
  });
});

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
