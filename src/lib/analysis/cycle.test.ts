import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  deleteRows: vi.fn(),
  insertRows: vi.fn(),
  values: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    transaction: dbMocks.transaction,
  },
}));

import {
  buildRestModeDaySet,
  buildCycleTemperatureDisplayData,
  buildThermalShiftRecords,
  currentConsecutiveTemperatureRun,
  detectThermalShifts,
  evaluateCycleTemperatures,
  getCycleEvaluationStartDay,
  longestConsecutiveTemperatureRun,
  runCyclePredictions,
  type CycleComputationOutcome,
} from "./cycle";

function dates(count: number, skipIndex?: number) {
  const rows: { day: string; temperatureDelta: number }[] = [];
  for (let index = 0; index < count; index++) {
    const offset = index + (skipIndex != null && index >= skipIndex ? 1 : 0);
    const date = new Date("2026-01-01T00:00:00Z");
    date.setUTCDate(date.getUTCDate() + offset);
    rows.push({
      day: date.toISOString().slice(0, 10),
      temperatureDelta: index < 8 ? 0 : 0.3,
    });
  }
  return rows;
}

function computation(
  overrides: Partial<CycleComputationOutcome>
): CycleComputationOutcome {
  return {
    state: "complete",
    outcome: "no_shifts",
    cycles: [],
    checkedThroughDay: "2026-01-30",
    latestTemperatureDay: "2026-01-30",
    eligibleTemperatureDays: 30,
    longestEligibleTemperatureRun: 30,
    currentEligibleTemperatureRun: 30,
    restModeExcludedTemperatureDays: 0,
    restModeActive: false,
    restModeCoverageLimited: false,
    insufficientReason: null,
    ...overrides,
  };
}

describe("cycle temperature continuity", () => {
  it("uses an inclusive 365-day evaluation window", () => {
    expect(getCycleEvaluationStartDay("2026-12-31")).toBe("2026-01-01");
  });

  it("requires calendar-consecutive temperature coverage", () => {
    expect(longestConsecutiveTemperatureRun(dates(30), new Set())).toBe(30);
    expect(longestConsecutiveTemperatureRun(dates(30, 15), new Set())).toBe(15);
    expect(currentConsecutiveTemperatureRun(dates(30, 15), new Set())).toBe(15);
  });

  it("does not bridge a data gap when detecting a thermal shift", () => {
    expect(detectThermalShifts(dates(20), new Set())).toContain(8);
    expect(detectThermalShifts(dates(20, 8), new Set())).not.toContain(8);
  });

  it("stores observed thermal shifts without inventing reproductive events", () => {
    const records = buildThermalShiftRecords(dates(40), [8, 30]);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      periodStartDay: null,
      thermalShiftDay: "2026-01-09",
      nextPeriodDay: null,
      interShiftDays: null,
    });
    expect(records[1]).toMatchObject({
      periodStartDay: null,
      thermalShiftDay: "2026-01-31",
      nextPeriodDay: null,
      interShiftDays: 22,
    });
  });

  it("treats an open Rest Mode period as active through the evaluation day", () => {
    const excludedDays = buildRestModeDaySet(
      [{ startDay: "2026-01-10", endDay: null }],
      "2026-01-01",
      "2026-01-12"
    );

    expect([...excludedDays]).toEqual([
      "2026-01-10",
      "2026-01-11",
      "2026-01-12",
    ]);
  });

  it("clips Rest Mode periods to the evaluated date range", () => {
    const excludedDays = buildRestModeDaySet(
      [
        { startDay: "2025-12-20", endDay: "2026-01-02" },
        { startDay: "2026-01-04", endDay: "2026-02-01" },
      ],
      "2026-01-01",
      "2026-01-05"
    );

    expect([...excludedDays]).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-04",
      "2026-01-05",
    ]);
  });

  it("distinguishes insufficient data from a complete result with no shift", () => {
    const insufficient = evaluateCycleTemperatures(
      dates(29),
      new Set(),
      "2026-01-29"
    );
    const complete = evaluateCycleTemperatures(
      dates(30).map((point) => ({ ...point, temperatureDelta: 0 })),
      new Set(),
      "2026-01-30"
    );

    expect(insufficient).toMatchObject({
      state: "insufficient_data",
      outcome: "insufficient_data",
      cycles: [],
      checkedThroughDay: "2026-01-29",
      latestTemperatureDay: "2026-01-29",
      eligibleTemperatureDays: 29,
      longestEligibleTemperatureRun: 29,
      currentEligibleTemperatureRun: 29,
      insufficientReason: "insufficient_consecutive_data",
    });
    expect(complete).toMatchObject({
      state: "complete",
      outcome: "no_shifts",
      cycles: [],
      checkedThroughDay: "2026-01-30",
      longestEligibleTemperatureRun: 30,
      currentEligibleTemperatureRun: 30,
      insufficientReason: null,
    });
  });

  it("reports Rest Mode as limiting coverage only when removing its exclusions restores the required run", () => {
    const points = dates(30);
    const checkedThroughDay = points[points.length - 1].day;
    const outcome = evaluateCycleTemperatures(
      points,
      new Set([checkedThroughDay]),
      checkedThroughDay
    );

    expect(outcome).toMatchObject({
      state: "insufficient_data",
      outcome: "insufficient_data",
      restModeActive: true,
      restModeExcludedTemperatureDays: 1,
      eligibleTemperatureDays: 29,
      longestEligibleTemperatureRun: 29,
      currentEligibleTemperatureRun: 0,
      restModeCoverageLimited: true,
      insufficientReason: "rest_mode_exclusions",
    });
  });

  it("reports Rest Mode exclusions separately from ordinary temperature gaps", () => {
    const points = dates(30);
    const outcome = evaluateCycleTemperatures(
      points,
      new Set([points[15].day]),
      points[points.length - 1].day
    );

    expect(outcome).toMatchObject({
      state: "insufficient_data",
      restModeActive: false,
      restModeExcludedTemperatureDays: 1,
      longestEligibleTemperatureRun: 15,
      currentEligibleTemperatureRun: 14,
      restModeCoverageLimited: true,
      insufficientReason: "rest_mode_exclusions",
    });
  });

  it("does not blame Rest Mode when ordinary gaps already prevent eligibility", () => {
    const points = dates(20, 10);
    const outcome = evaluateCycleTemperatures(
      points,
      new Set([points[5].day]),
      points[points.length - 1].day
    );

    expect(outcome).toMatchObject({
      state: "insufficient_data",
      restModeExcludedTemperatureDays: 1,
      restModeCoverageLimited: false,
      insufficientReason: "insufficient_consecutive_data",
    });
  });

  it("reports a checked zero-data evaluation without inventing a result", () => {
    expect(
      evaluateCycleTemperatures([], new Set(), "2026-01-30")
    ).toMatchObject({
      state: "insufficient_data",
      outcome: "insufficient_data",
      checkedThroughDay: "2026-01-30",
      latestTemperatureDay: null,
      eligibleTemperatureDays: 0,
      longestEligibleTemperatureRun: 0,
      currentEligibleTemperatureRun: 0,
      insufficientReason: "no_temperature_data",
    });
  });

  it("does not call an older eligible run current", () => {
    const outcome = evaluateCycleTemperatures(
      dates(30),
      new Set(),
      "2026-01-31"
    );

    expect(outcome).toMatchObject({
      state: "complete",
      longestEligibleTemperatureRun: 30,
      currentEligibleTemperatureRun: 0,
      latestTemperatureDay: "2026-01-30",
      checkedThroughDay: "2026-01-31",
    });
  });

  it("ignores temperatures after the evaluation end", () => {
    const outcome = evaluateCycleTemperatures(
      dates(31),
      new Set(),
      "2026-01-30"
    );

    expect(outcome).toMatchObject({
      eligibleTemperatureDays: 30,
      latestTemperatureDay: "2026-01-30",
      currentEligibleTemperatureRun: 30,
    });
  });

  it("densifies display days and marks recorded Rest Mode exclusions", () => {
    expect(
      buildCycleTemperatureDisplayData(
        [
          { day: "2026-01-01", temperatureDelta: 0.1 },
          { day: "2026-01-03", temperatureDelta: 0.2 },
          { day: "2026-01-04", temperatureDelta: 0.3 },
        ],
        new Set(["2026-01-03"]),
        "2026-01-01",
        "2026-01-03"
      )
    ).toEqual([
      {
        day: "2026-01-01",
        temperatureDelta: 0.1,
        restModeExcluded: false,
      },
      {
        day: "2026-01-02",
        temperatureDelta: null,
        restModeExcluded: false,
      },
      {
        day: "2026-01-03",
        temperatureDelta: 0.2,
        restModeExcluded: true,
      },
    ]);
  });
});

describe("cycle result persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.insertRows.mockReturnValue({ values: dbMocks.values });
    dbMocks.transaction.mockImplementation(async (callback) =>
      callback({
        delete: dbMocks.deleteRows,
        insert: dbMocks.insertRows,
      })
    );
  });

  it("retains stored results when current coverage is insufficient", async () => {
    const result = await runCyclePredictions(async () =>
      computation({
        state: "insufficient_data",
        outcome: "insufficient_data",
        latestTemperatureDay: "2026-01-18",
        eligibleTemperatureDays: 18,
        longestEligibleTemperatureRun: 18,
        currentEligibleTemperatureRun: 18,
        insufficientReason: "insufficient_consecutive_data",
      })
    );

    expect(result).toMatchObject({
      cyclesDetected: 0,
      state: "retained_insufficient_data",
      eligibleTemperatureRun: 18,
      evaluation: {
        state: "insufficient_data",
        longestEligibleTemperatureRun: 18,
      },
    });
    expect(dbMocks.transaction).not.toHaveBeenCalled();
    expect(dbMocks.deleteRows).not.toHaveBeenCalled();
  });

  it("atomically replaces stored results after a complete computation", async () => {
    const result = await runCyclePredictions(async () =>
      computation({
        outcome: "shifts_detected",
        cycles: [
          {
            cycleNumber: 1,
            periodStartDay: null,
            thermalShiftDay: "2026-01-09",
            nextPeriodDay: null,
            interShiftDays: null,
            evidenceStrength: 0.6,
          },
        ],
      })
    );

    expect(dbMocks.transaction).toHaveBeenCalledOnce();
    expect(dbMocks.deleteRows).toHaveBeenCalledOnce();
    expect(dbMocks.values).toHaveBeenCalledWith([
      expect.objectContaining({
        cycleNumber: 1,
        thermalShiftDay: "2026-01-09",
        confidence: 0.6,
      }),
    ]);
    expect(result).toMatchObject({
      cyclesDetected: 1,
      state: "replaced",
      eligibleTemperatureRun: 30,
    });
  });

  it("clears prior results only when a complete computation finds no shift", async () => {
    const result = await runCyclePredictions(async () => computation({}));

    expect(dbMocks.transaction).toHaveBeenCalledOnce();
    expect(dbMocks.deleteRows).toHaveBeenCalledOnce();
    expect(dbMocks.insertRows).not.toHaveBeenCalled();
    expect(result.state).toBe("replaced");
  });
});
