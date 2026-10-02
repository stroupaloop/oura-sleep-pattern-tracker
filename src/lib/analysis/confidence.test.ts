import { describe, expect, it } from "vitest";
import {
  summarizeEtSleepAvailability,
  summarizeWornActivityAvailability,
} from "./confidence";

describe("ET data availability", () => {
  it("counts long sleep by ET sleep day rather than Oura source day", () => {
    expect(
      summarizeEtSleepAvailability(
        [
          { bedtimeEnd: "2026-07-30T17:30:00-10:00" },
          { bedtimeEnd: "2026-07-31T17:30:00-10:00" },
          { bedtimeEnd: "2026-07-31T18:00:00-10:00" },
        ],
        "2026-07-31",
        "2026-08-01"
      )
    ).toEqual({
      measuredDays: 2,
      latestDay: "2026-08-01",
    });
  });

  it("ignores invalid timestamps and ET sleep days outside the window", () => {
    expect(
      summarizeEtSleepAvailability(
        [
          { bedtimeEnd: "not-a-timestamp" },
          { bedtimeEnd: "2026-07-29T08:00:00-07:00" },
          { bedtimeEnd: null },
        ],
        "2026-07-31",
        "2026-08-01"
      )
    ).toEqual({
      measuredDays: 0,
      latestDay: null,
    });
  });
});

describe("summarizeWornActivityAvailability", () => {
  it("does not count a day the ring spent off the finger", () => {
    expect(
      summarizeWornActivityAvailability(
        [
          { day: "2026-09-28", classifiedMinutes: 1200, nonWearMinutes: 1200 },
          { day: "2026-09-29", classifiedMinutes: 1440, nonWearMinutes: 300 },
          { day: "2026-09-30", classifiedMinutes: 0, nonWearMinutes: 0 },
        ],
        "2026-09-01",
        "2026-09-30"
      )
    ).toEqual({ measuredDays: 1, latestDay: "2026-09-29" });
  });
});
