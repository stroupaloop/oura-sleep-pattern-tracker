import { describe, expect, it } from "vitest";
import {
  circularDifferenceMinutes,
  circularMeanMinutes,
  circularVariation,
  circularZScore,
  isNextCalendarDay,
  minutesFromMidnight,
  robustCircularStandardDeviationMinutes,
  robustStandardDeviation,
  standardDeviation,
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

  it("measures the usual spread without letting one far-off night widen it", () => {
    const steady = Array.from({ length: 20 }, (_, index) =>
      index % 2 === 0 ? 400 : 440
    );
    const clean = robustStandardDeviation(steady, 420);
    expect(clean).toBeCloseTo(standardDeviation(steady, 420) * 1.0136, 6);
    expect(robustStandardDeviation([...steady, 600], 420)).toBeCloseTo(clean, 6);
    expect(standardDeviation([...steady, 600], 420)).toBeGreaterThan(2 * clean);
  });

  it("keeps the spread of integer metrics with many ties", () => {
    const efficiency = [
      ...Array<number>(11).fill(88),
      ...Array<number>(6).fill(89),
      ...Array<number>(3).fill(87),
    ];
    const center = trimmedMean(efficiency);
    expect(robustStandardDeviation(efficiency, center)).toBeCloseTo(
      standardDeviation(efficiency, center) * 1.0136,
      6
    );
  });

  it("falls back to the full spread when most nights tie", () => {
    const values = [...Array<number>(16).fill(50), 40, 45, 60, 80];
    expect(robustStandardDeviation(values, 50)).toBeCloseTo(
      standardDeviation(values, 50),
      10
    );
    expect(robustStandardDeviation(Array<number>(20).fill(50), 50)).toBe(0);
    expect(Number.isNaN(robustStandardDeviation([50], 50))).toBe(true);
  });

  it("keeps a 4am bedtime from widening a spread that straddles midnight", () => {
    const bedtimes = Array.from({ length: 20 }, (_, index) =>
      index % 2 === 0 ? -15 : 15
    );
    const clean = robustCircularStandardDeviationMinutes(bedtimes);
    expect(clean).toBeCloseTo(15.6, 1);
    const withLateNight = robustCircularStandardDeviationMinutes([...bedtimes, 240]);
    expect(withLateNight).toBeGreaterThan(clean);
    expect(withLateNight).toBeLessThan(20);
  });
});
