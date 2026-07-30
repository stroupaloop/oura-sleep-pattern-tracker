import { describe, expect, it } from "vitest";
import {
  averagePresent,
  computeCalendarRollingAverage,
  formatDuration,
  formatDurationDelta,
  summarizeStoredSamples,
} from "./dashboard-metrics";

describe("dashboard metric presentation", () => {
  it("excludes missing and invalid sleep durations from averages", () => {
    expect(averagePresent([28_800, null, 25_200, 0])).toBe(27_000);
    expect(averagePresent([null, 0])).toBeNull();
  });

  it("formats measured durations without treating zero as missing", () => {
    expect(formatDuration(0)).toBe("0h 0m");
    expect(formatDuration(27_000)).toBe("7h 30m");
    expect(formatDuration(null)).toBe("--");
  });

  it("formats negative and positive deltas using their absolute duration", () => {
    expect(formatDurationDelta(-1_800)).toBe("-30m");
    expect(formatDurationDelta(4_500)).toBe("+1h 15m");
    expect(formatDurationDelta(0)).toBe("0m");
  });

  it("summarizes finite app-aligned samples without replacing gaps", () => {
    expect(summarizeStoredSamples("[60,null,54]")).toEqual({
      average: 57,
      minimum: 54,
    });
    expect(
      summarizeStoredSamples(
        '{"timestamp":"2026-01-01T22:00:00-05:00","interval":300,"items":[60,null,54]}'
      )
    ).toEqual({
      average: 57,
      minimum: 54,
    });
    expect(summarizeStoredSamples("not-json")).toEqual({
      average: null,
      minimum: null,
    });
  });

  it("computes rolling averages over calendar days rather than observed rows", () => {
    const result = computeCalendarRollingAverage(
      [
        { day: "2026-01-01", value: 50 },
        { day: "2026-01-02", value: 60 },
        { day: "2026-01-10", value: 70 },
        { day: "2026-01-12", value: null },
      ],
      7
    );

    expect(result).toEqual([50, 55, 70, 70]);
  });

  it("preserves measured zero values in calendar windows", () => {
    expect(
      computeCalendarRollingAverage(
        [
          { day: "2026-01-01", value: 0 },
          { day: "2026-01-02", value: 10 },
        ],
        7
      )
    ).toEqual([0, 5]);
  });
});
