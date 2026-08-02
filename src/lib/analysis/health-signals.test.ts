import { describe, expect, it } from "vitest";
import {
  canEvaluateCycleHealthSignals,
  getHealthSignalResolutionCopy,
  isCycleDependentHealthSignal,
  latestConsecutiveValues,
  latestConsecutiveMatchingRun,
  longestConsecutiveMatchingRun,
  isRecentMeasurementDay,
  isWithinRecentCalendarDays,
  personalBaselineZScore,
} from "./health-signals";
import type { CycleComputationOutcome } from "./cycle";

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

  it("compares nighttime heart rate with the individual's recent baseline", () => {
    expect(personalBaselineZScore(70, [60, 61, 59, 60, 61, 59, 60])).toBeGreaterThan(
      2
    );
    expect(personalBaselineZScore(70, [68, 69, 67, 70, 68, 69, 67])).toBeLessThan(
      2
    );
  });

  it("does not manufacture a z-score without a variable personal baseline", () => {
    expect(personalBaselineZScore(70, [60])).toBeNull();
    expect(personalBaselineZScore(70, [60, 60, 60])).toBeNull();
  });

  it("does not reuse retained thermal shifts when the current cycle evaluation is insufficient", () => {
    const insufficientEvaluation: CycleComputationOutcome = {
      state: "insufficient_data",
      outcome: "insufficient_data",
      cycles: [],
      checkedThroughDay: "2026-08-02",
      latestTemperatureDay: "2026-07-30",
      eligibleTemperatureDays: 20,
      longestEligibleTemperatureRun: 20,
      currentEligibleTemperatureRun: 0,
      restModeExcludedTemperatureDays: 0,
      restModeActive: false,
      restModeCoverageLimited: false,
      insufficientReason: "insufficient_consecutive_data",
    };

    expect(canEvaluateCycleHealthSignals(insufficientEvaluation)).toBe(false);
    expect(isCycleDependentHealthSignal("sustained_temperature")).toBe(true);
    expect(isCycleDependentHealthSignal("thermal_shift_timing")).toBe(true);
    expect(isCycleDependentHealthSignal("acute_illness")).toBe(false);
    expect(
      getHealthSignalResolutionCopy(
        "sustained_temperature",
        "2026-08-02",
        false
      )
    ).toEqual({
      summary:
        "This prior temperature-based signal is no longer active because current coverage is insufficient to reevaluate it.",
      details:
        "Marked inactive on 2026-08-02; retained historical thermal shifts were not reused without a complete current temperature evaluation.",
    });
  });
});
