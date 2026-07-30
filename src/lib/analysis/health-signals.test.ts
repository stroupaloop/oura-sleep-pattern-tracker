import { describe, expect, it } from "vitest";
import {
  latestConsecutiveValues,
  latestConsecutiveMatchingRun,
  longestConsecutiveMatchingRun,
  isRecentMeasurementDay,
  isWithinRecentCalendarDays,
} from "./health-signals";

describe("health signal continuity", () => {
  const values = [
    { day: "2026-07-01", value: 1 },
    { day: "2026-07-02", value: 1 },
    { day: "2026-07-04", value: 1 },
    { day: "2026-07-05", value: 1 },
  ];

  it("uses only the latest consecutive baseline tail", () => {
    expect(latestConsecutiveValues(values, 14).map((row) => row.day)).toEqual([
      "2026-07-04",
      "2026-07-05",
    ]);
  });

  it("resets sustained evidence at a missing calendar day", () => {
    expect(longestConsecutiveMatchingRun(values, (value) => value > 0)).toBe(2);
  });

  it("requires a sustained pattern to reach the newest eligible day", () => {
    const normalized = [
      { day: "2026-07-01", value: 1 },
      { day: "2026-07-02", value: 1 },
      { day: "2026-07-03", value: 0 },
    ];
    expect(
      longestConsecutiveMatchingRun(normalized, (value) => value > 0)
    ).toBe(2);
    expect(
      latestConsecutiveMatchingRun(normalized, (value) => value > 0)
    ).toBe(0);
  });

  it("rejects stale measurements when creating a current signal", () => {
    expect(isRecentMeasurementDay("2026-07-30", "2026-07-30")).toBe(true);
    expect(isRecentMeasurementDay("2026-07-29", "2026-07-30")).toBe(true);
    expect(isRecentMeasurementDay("2026-07-28", "2026-07-30")).toBe(false);
    expect(
      isWithinRecentCalendarDays("2026-07-23", "2026-07-30", 7)
    ).toBe(true);
    expect(
      isWithinRecentCalendarDays("2026-07-22", "2026-07-30", 7)
    ).toBe(false);
  });
});
