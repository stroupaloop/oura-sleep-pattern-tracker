import { describe, expect, it } from "vitest";
import {
  circularDifferenceMinutes,
  circularMeanMinutes,
  circularVariation,
  circularZScore,
  isNextCalendarDay,
  minutesFromMidnight,
  trimmedMean,
} from "./baseline";

describe("baseline helpers", () => {
  it("uses the wall-clock time encoded by the Oura timestamp", () => {
    expect(minutesFromMidnight("2026-07-01T23:30:00-07:00")).toBe(-30);
    expect(minutesFromMidnight("2026-07-02T00:30:00+09:00")).toBe(30);
  });

  it("handles clock times across midnight circularly", () => {
    const center = circularMeanMinutes([-30, 30]);
    expect(Math.abs(center)).toBeLessThan(0.001);
    expect(circularDifferenceMinutes(10, -10)).toBe(20);
    expect(circularZScore(10, -10, 20)).toBe(1);
    expect(circularVariation([-30, 30])).toBeLessThan(0.01);
  });

  it("ignores missing numeric values instead of making them zero", () => {
    expect(trimmedMean([1, Number.NaN, 3])).toBe(2);
    expect(Number.isNaN(trimmedMean([Number.NaN]))).toBe(true);
  });

  it("uses calendar dates rather than elapsed local-time hours", () => {
    expect(isNextCalendarDay("2026-03-07", "2026-03-08")).toBe(true);
    expect(isNextCalendarDay("2026-03-07", "2026-03-09")).toBe(false);
  });
});
