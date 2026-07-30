import { describe, expect, it } from "vitest";
import { computeTrend } from "./generate";

describe("computeTrend", () => {
  it("reports insufficient data below the seven-observation minimum", () => {
    expect(computeTrend([])).toBe("insufficient_data");
    expect(computeTrend([1, 2, 3, 4, 5, 6])).toBe("insufficient_data");
  });

  it("classifies trends once seven observations are available", () => {
    expect(computeTrend([100, 100, 100, 103, 103, 103, 103])).toBe("stable");
    expect(computeTrend([100, 100, 100, 110, 110, 110, 110])).toBe(
      "increasing"
    );
    expect(computeTrend([110, 110, 110, 100, 100, 100, 100])).toBe(
      "decreasing"
    );
  });
});
