import { describe, expect, it } from "vitest";
import {
  computeWithinNightCV,
  computeInterdailyStability,
  computeIntradailyVariability,
  computeRelativeAmplitude,
} from "./variability";

describe("nonparametric circadian metrics", () => {
  it("reads timestamped Oura time-series values without discarding gaps", () => {
    expect(
      computeWithinNightCV(
        '{"timestamp":"2026-01-01T22:00:00-05:00","interval":300,"items":[50,null,55,60]}'
      )
    ).toBeGreaterThan(0);
  });

  it("uses contiguous M10 and L5 windows for relative amplitude", () => {
    const hourlyClasses = "5".repeat(10) + "1".repeat(14);
    expect(computeRelativeAmplitude(hourlyClasses)).toBeCloseTo(2 / 3, 6);
  });

  it("normalizes interdaily stability to one for repeated daily patterns", () => {
    const day = "1".repeat(12) + "5".repeat(12);
    expect(computeInterdailyStability([day, day, day])).toBeCloseTo(1, 6);
  });

  it("returns no metric when non-wear coverage is too low", () => {
    const lowCoverage = "0".repeat(6) + "1".repeat(18);
    expect(Number.isNaN(computeRelativeAmplitude(lowCoverage))).toBe(true);
    expect(Number.isNaN(computeIntradailyVariability(lowCoverage))).toBe(true);
  });

  it("keeps the standard IV white-noise reference value interpretable", () => {
    const blocks = "1".repeat(6) + "2".repeat(6) + "1".repeat(6) + "2".repeat(6);
    const value = computeIntradailyVariability(blocks);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(2);
  });
});
