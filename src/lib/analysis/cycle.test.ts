import { describe, expect, it } from "vitest";
import {
  buildThermalShiftRecords,
  detectThermalShifts,
  longestConsecutiveTemperatureRun,
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
      ovulationDay: "2026-01-09",
      nextPeriodDay: null,
      cycleLength: null,
    });
    expect(records[1]).toMatchObject({
      periodStartDay: null,
      ovulationDay: "2026-01-31",
      nextPeriodDay: null,
      cycleLength: 22,
    });
  });
});
