import { afterEach, describe, expect, it, vi } from "vitest";
import { getTodayET } from "@/lib/date-utils";
import { fillCalendarDays } from "./calendar-rows";

interface Row {
  day: string;
  hours: number | null;
  noNight?: boolean;
}

const night = (day: string, hours = 7): Row => ({ day, hours });
const gap = (day: string): Row => ({ day, hours: null, noNight: true });

describe("fillCalendarDays", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts one empty row in every missing day between nights", () => {
    const rows = [
      night("2026-09-26"),
      night("2026-09-27"),
      night("2026-10-02"),
      night("2026-10-03"),
    ];

    const filled = fillCalendarDays(
      rows,
      { start: "2026-09-26", end: "2026-10-03" },
      gap
    );

    expect(filled.map((row) => row.day)).toEqual([
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(filled.filter((row) => row.noNight).map((row) => row.day)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
    ]);
    for (const row of filled.filter((row) => row.noNight)) {
      expect(row.hours).toBeNull();
    }
  });

  it("hands back the rows it was given untouched", () => {
    const first = night("2026-10-01", 6.5);
    const last = night("2026-10-03", 8);

    const filled = fillCalendarDays(
      [first, last],
      { start: "2026-10-01", end: "2026-10-03" },
      gap
    );

    expect(filled[0]).toBe(first);
    expect(filled[2]).toBe(last);
    expect(filled[1]).toEqual(gap("2026-10-02"));
    expect(first).toEqual({ day: "2026-10-01", hours: 6.5 });
  });

  it("puts rows in date order whatever order they arrive in", () => {
    const filled = fillCalendarDays(
      [night("2026-10-03"), night("2026-10-01")],
      { start: "2026-10-01", end: "2026-10-03" },
      gap
    );

    expect(filled.map((row) => row.day)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
  });

  it("leaves days before the first night off", () => {
    const filled = fillCalendarDays(
      [night("2026-10-04"), night("2026-10-06")],
      { start: "2026-09-07", end: "2026-10-06" },
      gap
    );

    expect(filled.map((row) => row.day)).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
  });

  it("runs through the end day when the newest nights are missing", () => {
    const filled = fillCalendarDays(
      [night("2026-10-03")],
      { start: "2026-09-07", end: "2026-10-06" },
      gap
    );

    expect(filled.map((row) => row.day)).toEqual([
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
    expect(filled.slice(1).every((row) => row.noNight)).toBe(true);
  });

  it("ignores rows outside the range", () => {
    const filled = fillCalendarDays(
      [night("2026-09-01"), night("2026-10-02"), night("2026-10-09")],
      { start: "2026-10-01", end: "2026-10-04" },
      gap
    );

    expect(filled.map((row) => row.day)).toEqual([
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it("steps by calendar date across daylight-saving changes and month ends", () => {
    const spans: Array<[string, string, number]> = [
      ["2026-03-07", "2026-03-09", 3],
      ["2026-10-31", "2026-11-02", 3],
      ["2026-12-30", "2027-01-02", 4],
      ["2028-02-28", "2028-03-01", 3],
    ];

    for (const [start, end, count] of spans) {
      const filled = fillCalendarDays([night(start)], { start, end }, gap);
      const days = filled.map((row) => row.day);

      expect(days).toHaveLength(count);
      expect(days[0]).toBe(start);
      expect(days.at(-1)).toBe(end);
      expect(new Set(days).size).toBe(count);
      for (const day of days) expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    const leap = fillCalendarDays(
      [night("2028-02-28")],
      { start: "2028-02-28", end: "2028-03-01" },
      gap
    );
    expect(leap.map((row) => row.day)).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("reaches today in Eastern time when it is already tomorrow in UTC", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T02:30:00Z"));
    const today = getTodayET();

    const filled = fillCalendarDays(
      [night("2026-10-04")],
      { start: "2026-10-01", end: today },
      gap
    );

    expect(today).toBe("2026-10-06");
    expect(filled.map((row) => row.day)).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
  });

  it("returns nothing, and builds no rows, when there are no nights to draw", () => {
    const empty = vi.fn(gap);

    expect(
      fillCalendarDays([], { start: "2026-10-01", end: "2026-10-06" }, empty)
    ).toEqual([]);
    expect(
      fillCalendarDays(
        [night("2026-09-01")],
        { start: "2026-10-01", end: "2026-10-06" },
        empty
      )
    ).toEqual([]);
    expect(empty).not.toHaveBeenCalled();
  });

  it("returns nothing for a range that is not made of days", () => {
    expect(
      fillCalendarDays([night("2026-10-01")], { start: "soon", end: "2026-10-06" }, gap)
    ).toEqual([]);
    expect(
      fillCalendarDays([night("2026-10-01")], { start: "2026-10-01", end: "2026-02-31" }, gap)
    ).toEqual([]);
    expect(
      fillCalendarDays([night("2026-10-01")], { start: "2026-10-06", end: "2026-10-01" }, gap)
    ).toEqual([]);
  });
});
