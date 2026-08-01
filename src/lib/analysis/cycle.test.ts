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
  buildThermalShiftRecords,
  detectThermalShifts,
  evaluateCycleTemperatures,
  longestConsecutiveTemperatureRun,
  runCyclePredictions,
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

describe("cycle temperature continuity", () => {
  it("requires calendar-consecutive temperature coverage", () => {
    expect(longestConsecutiveTemperatureRun(dates(30), new Set())).toBe(30);
    expect(longestConsecutiveTemperatureRun(dates(30, 15), new Set())).toBe(15);
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
    const insufficient = evaluateCycleTemperatures(dates(29), new Set());
    const complete = evaluateCycleTemperatures(
      dates(30).map((point) => ({ ...point, temperatureDelta: 0 })),
      new Set()
    );

    expect(insufficient).toMatchObject({
      state: "insufficient_data",
      cycles: [],
      eligibleTemperatureRun: 29,
    });
    expect(complete).toMatchObject({
      state: "complete",
      cycles: [],
      eligibleTemperatureRun: 30,
    });
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
    const result = await runCyclePredictions(async () => ({
      state: "insufficient_data",
      cycles: [],
      eligibleTemperatureRun: 18,
    }));

    expect(result).toEqual({
      cyclesDetected: 0,
      state: "retained_insufficient_data",
      eligibleTemperatureRun: 18,
    });
    expect(dbMocks.transaction).not.toHaveBeenCalled();
    expect(dbMocks.deleteRows).not.toHaveBeenCalled();
  });

  it("atomically replaces stored results after a complete computation", async () => {
    const result = await runCyclePredictions(async () => ({
      state: "complete",
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
      eligibleTemperatureRun: 30,
    }));

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
    const result = await runCyclePredictions(async () => ({
      state: "complete",
      cycles: [],
      eligibleTemperatureRun: 30,
    }));

    expect(dbMocks.transaction).toHaveBeenCalledOnce();
    expect(dbMocks.deleteRows).toHaveBeenCalledOnce();
    expect(dbMocks.insertRows).not.toHaveBeenCalled();
    expect(result.state).toBe("replaced");
  });
});
