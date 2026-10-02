import { describe, expect, it } from "vitest";
import { buildNightWindow, formatClockMinutes } from "./night-window";

describe("formatClockMinutes", () => {
  it("formats minutes on a 24-hour clock, wrapping either way", () => {
    expect(formatClockMinutes(0)).toBe("12:00 AM");
    expect(formatClockMinutes(-15)).toBe("11:45 PM");
    expect(formatClockMinutes(452)).toBe("7:32 AM");
    expect(formatClockMinutes(1440 + 130)).toBe("2:10 AM");
    expect(formatClockMinutes(720, "short")).toBe("12 PM");
    expect(formatClockMinutes(90, "short")).toBe("1:30 AM");
  });
});

describe("buildNightWindow", () => {
  it("places a late, short night against the usual window", () => {
    const window = buildNightWindow(
      [
        {
          bedtimeStart: "2026-09-30T02:10:00-04:00",
          bedtimeEnd: "2026-09-30T07:54:00-04:00",
          hypnogram5min: "2211334",
        },
      ],
      { bedtimeMinutes: -15, wakeMinutes: 452 }
    );

    expect(window).not.toBeNull();
    // The axis opens on the hour before the earlier bedtime (11:45 PM).
    expect(window!.ticks[0]).toEqual({ at: 60, label: "12 AM" });
    expect(window!.span).toBe(10 * 60);
    expect(window!.usual).toEqual({ bedtime: 45, wake: 45 + 467 });
    expect(window!.bedtime).toBe(190);
    expect(window!.wake).toBe(190 + 344);
    expect(window!.bedtimeLabel).toBe("2:10 AM");
    expect(window!.wakeLabel).toBe("7:54 AM");
    expect(window!.segments).toEqual([
      { start: 190, end: 200, stage: "light" },
      { start: 200, end: 210, stage: "deep" },
      { start: 210, end: 220, stage: "rem" },
      { start: 220, end: 225, stage: "awake" },
    ]);
  });

  it("keeps the gap between two stretches of one night", () => {
    const window = buildNightWindow(
      [
        {
          bedtimeStart: "2026-08-30T03:00:00-04:00",
          bedtimeEnd: "2026-08-30T06:30:00-04:00",
          hypnogram5min: null,
        },
        {
          bedtimeStart: "2026-08-29T22:00:00-04:00",
          bedtimeEnd: "2026-08-30T01:30:00-04:00",
          hypnogram5min: null,
        },
      ],
      null
    );

    expect(window!.usual).toBeNull();
    expect(window!.bedtimeLabel).toBe("10:00 PM");
    expect(window!.wakeLabel).toBe("6:30 AM");
    expect(window!.segments).toEqual([
      { start: 60, end: 270, stage: "asleep" },
      { start: 360, end: 570, stage: "asleep" },
    ]);
  });

  it("leaves out a usual window that does not hold together", () => {
    const window = buildNightWindow(
      [
        {
          bedtimeStart: "2026-09-30T00:00:00-04:00",
          bedtimeEnd: "2026-09-30T07:00:00-04:00",
          hypnogram5min: null,
        },
      ],
      { bedtimeMinutes: Number.NaN, wakeMinutes: 420 }
    );

    expect(window!.usual).toBeNull();
  });

  it("returns null without a usable period", () => {
    expect(buildNightWindow([], null)).toBeNull();
    expect(
      buildNightWindow(
        [
          {
            bedtimeStart: "2026-09-30T07:00:00-04:00",
            bedtimeEnd: "2026-09-30T01:00:00-04:00",
            hypnogram5min: null,
          },
        ],
        null
      )
    ).toBeNull();
  });
});
