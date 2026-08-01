import { describe, expect, it } from "vitest";
import { summarizeEtSleepAvailability } from "./confidence";

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
