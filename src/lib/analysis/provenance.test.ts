import { describe, expect, it } from "vitest";
import {
  currentDailyPatternFields,
  filterCurrentPatternAssessments,
  hasCurrentPatternProvenance,
  PATTERN_ALGORITHM_VERSION,
  PATTERN_SIGNAL_MODE,
} from "./provenance";

describe("pattern provenance", () => {
  const current = {
    configVersion: 3,
    bipolarProfile: "bp2",
    algorithmVersion: PATTERN_ALGORITHM_VERSION,
    signalMode: PATTERN_SIGNAL_MODE,
  };

  it("accepts only an exact config, profile, algorithm, and signal-mode match", () => {
    expect(hasCurrentPatternProvenance(current, 3, "bp2")).toBe(true);
    expect(hasCurrentPatternProvenance(current, 4, "bp2")).toBe(false);
    expect(hasCurrentPatternProvenance(current, 3, "bp1")).toBe(false);
    expect(
      hasCurrentPatternProvenance(
        { ...current, algorithmVersion: "legacy" },
        3,
        "bp2"
      )
    ).toBe(false);
    expect(
      hasCurrentPatternProvenance(
        { ...current, signalMode: "self-report-informed" },
        3,
        "bp2"
      )
    ).toBe(false);
  });

  it("rejects legacy rows without provenance", () => {
    expect(
      hasCurrentPatternProvenance(
        {
          configVersion: 3,
          bipolarProfile: null,
          algorithmVersion: null,
          signalMode: null,
        },
        3,
        "bp2"
      )
    ).toBe(false);
  });

  it("centrally filters assessment collections to the exact current context", () => {
    const rows = [
      { day: "2026-07-30", tier: "watch", ...current },
      {
        day: "2026-07-29",
        tier: "alert",
        ...current,
        configVersion: 2,
      },
      {
        day: "2026-07-28",
        tier: "warning",
        ...current,
        bipolarProfile: "bp1",
      },
    ];

    expect(filterCurrentPatternAssessments(rows, 3, "bp2")).toEqual([
      rows[0],
    ]);
  });

  it("suppresses daily pattern fields without a current assessment marker", () => {
    const currentDays = new Set(["2026-07-30"]);
    const fields = {
      anomalyScore: 1.4,
      isAnomaly: 1,
      anomalyDirection: "hyper",
    };

    expect(
      currentDailyPatternFields("2026-07-30", fields, currentDays)
    ).toEqual(fields);
    expect(
      currentDailyPatternFields("2026-07-29", fields, currentDays)
    ).toEqual({
      anomalyScore: null,
      isAnomaly: null,
      anomalyDirection: null,
    });
    expect(
      currentDailyPatternFields(
        "2026-07-29",
        { isAnomaly: 1, anomalyDirection: "hyper" },
        currentDays
      )
    ).toEqual({
      isAnomaly: null,
      anomalyDirection: null,
    });
  });
});
