import { describe, expect, it } from "vitest";
import type { NightSleepPeriod } from "@/lib/oura/main-sleep";
import { encodeSleepTimeOffset } from "@/lib/oura/sleep-time";
import { buildBedtimeData, latestNightSourceDay } from "./sleep-timing-data";

function period(
  type: "long_sleep" | "sleep",
  day: string,
  bedtimeStart: string,
  bedtimeEnd: string,
  asleepMinutes: number
): NightSleepPeriod {
  return {
    day,
    type,
    bedtimeStart,
    bedtimeEnd,
    totalSleepDuration: asleepMinutes * 60,
  };
}

const MONDAY_NIGHT = period(
  "long_sleep",
  "2026-09-08",
  "2026-09-07T23:10:00-04:00",
  "2026-09-08T06:50:00-04:00",
  420
);
const SHORT_NIGHT = period(
  "sleep",
  "2026-09-09",
  "2026-09-09T03:30:00-04:00",
  "2026-09-09T05:50:00-04:00",
  130
);
const NIGHT = period(
  "long_sleep",
  "2026-09-10",
  "2026-09-09T23:00:00-04:00",
  "2026-09-10T06:30:00-04:00",
  420
);
const AFTERNOON_CRASH = period(
  "long_sleep",
  "2026-09-10",
  "2026-09-10T13:00:00-04:00",
  "2026-09-10T17:30:00-04:00",
  250
);

describe("buildBedtimeData", () => {
  it("includes a short night Oura typed sleep, named for the morning it ends", () => {
    const rows = buildBedtimeData([MONDAY_NIGHT, SHORT_NIGHT], []);

    expect(rows.map((row) => [row.day, row.actualBedtime])).toEqual([
      ["2026-09-08", 23 * 60 + 10],
      ["2026-09-09", 24 * 60 + 3 * 60 + 30],
    ]);
  });

  it("does not let an afternoon sleep stand in for the night or repeat its day", () => {
    for (const periods of [
      [NIGHT, AFTERNOON_CRASH],
      [AFTERNOON_CRASH, NIGHT],
    ]) {
      const rows = buildBedtimeData(periods, []);

      expect(rows).toHaveLength(1);
      expect(rows[0].day).toBe("2026-09-10");
      expect(rows[0].actualBedtime).toBe(23 * 60);
    }
  });

  it("gives a broken night one row, at its first bedtime", () => {
    const rows = buildBedtimeData(
      [
        period(
          "sleep",
          "2026-09-11",
          "2026-09-11T04:00:00-04:00",
          "2026-09-11T06:10:00-04:00",
          120
        ),
        period(
          "long_sleep",
          "2026-09-11",
          "2026-09-10T21:30:00-04:00",
          "2026-09-11T02:30:00-04:00",
          270
        ),
      ],
      []
    );

    expect(rows.map((row) => [row.day, row.actualBedtime])).toEqual([
      ["2026-09-11", 21 * 60 + 30],
    ]);
  });

  it("leaves out a nap and a brief doze", () => {
    const rows = buildBedtimeData(
      [
        period(
          "sleep",
          "2026-09-12",
          "2026-09-12T13:00:00-04:00",
          "2026-09-12T14:30:00-04:00",
          80
        ),
        period(
          "sleep",
          "2026-09-13",
          "2026-09-12T21:00:00-04:00",
          "2026-09-12T21:40:00-04:00",
          30
        ),
      ],
      []
    );

    expect(rows).toEqual([]);
  });

  it("lists nights oldest first and adds Oura's suggested window to the short one", () => {
    const rows = buildBedtimeData(
      [SHORT_NIGHT, MONDAY_NIGHT],
      [
        {
          day: "2026-09-09",
          optimalBedtimeStart: encodeSleepTimeOffset(-3600, -14400),
          optimalBedtimeEnd: encodeSleepTimeOffset(1800, -14400),
        },
      ]
    );

    expect(rows).toEqual([
      {
        day: "2026-09-08",
        actualBedtime: 23 * 60 + 10,
        optimalStart: null,
        optimalEnd: null,
      },
      {
        day: "2026-09-09",
        actualBedtime: 24 * 60 + 3 * 60 + 30,
        optimalStart: 23 * 60,
        optimalEnd: 24 * 60 + 30,
      },
    ]);
  });
});

describe("latestNightSourceDay", () => {
  it("counts a short night Oura typed sleep as the latest night", () => {
    expect(latestNightSourceDay([MONDAY_NIGHT, SHORT_NIGHT])).toBe(
      "2026-09-09"
    );
  });

  it("takes the morning a broken night ends", () => {
    expect(
      latestNightSourceDay([
        MONDAY_NIGHT,
        period(
          "long_sleep",
          "2026-09-11",
          "2026-09-10T22:00:00-04:00",
          "2026-09-11T01:30:00-04:00",
          200
        ),
        period(
          "sleep",
          "2026-09-11",
          "2026-09-11T03:00:00-04:00",
          "2026-09-11T06:30:00-04:00",
          200
        ),
      ])
    ).toBe("2026-09-11");
  });

  it("is not moved on by a later nap, which is not last night arriving", () => {
    expect(
      latestNightSourceDay([
        NIGHT,
        period(
          "sleep",
          "2026-09-11",
          "2026-09-11T13:00:00-04:00",
          "2026-09-11T14:30:00-04:00",
          80
        ),
      ])
    ).toBe("2026-09-10");
  });

  it("is empty without a night", () => {
    expect(latestNightSourceDay([])).toBeNull();
    expect(
      latestNightSourceDay([
        period(
          "sleep",
          "2026-09-11",
          "2026-09-11T13:00:00-04:00",
          "2026-09-11T14:30:00-04:00",
          80
        ),
      ])
    ).toBeNull();
  });
});
