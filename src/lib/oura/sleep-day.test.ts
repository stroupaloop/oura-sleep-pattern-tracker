import { describe, expect, it } from "vitest";
import {
  getOuraSleepDayForTimestamp,
  selectSleepForSleepDay,
} from "./sleep-day";

describe("getOuraSleepDayForTimestamp", () => {
  it("uses Oura's 6 p.m. sleep-day boundary in ET", () => {
    expect(
      getOuraSleepDayForTimestamp("2026-07-30T19:00:00-04:00")
    ).toBe("2026-07-31");
    expect(
      getOuraSleepDayForTimestamp("2026-07-31T17:59:00-04:00")
    ).toBe("2026-07-31");
    expect(
      getOuraSleepDayForTimestamp("2026-07-31T18:00:00-04:00")
    ).toBe("2026-08-01");
  });

  it("translates source offsets before assigning the ET sleep day", () => {
    expect(getOuraSleepDayForTimestamp("2026-07-31T03:30:00Z")).toBe(
      "2026-07-31"
    );
  });

  it("remains stable across ET daylight-saving transitions", () => {
    expect(
      getOuraSleepDayForTimestamp("2026-03-08T08:00:00-04:00")
    ).toBe("2026-03-08");
    expect(
      getOuraSleepDayForTimestamp("2026-11-01T08:00:00-05:00")
    ).toBe("2026-11-01");
  });

  it("fails closed for invalid or timezone-free timestamps", () => {
    expect(getOuraSleepDayForTimestamp("not-a-timestamp")).toBeNull();
    expect(
      getOuraSleepDayForTimestamp("2026-07-31T08:00:00")
    ).toBeNull();
  });
});

describe("selectSleepForSleepDay", () => {
  it("does not substitute an older sleep for a missing current sleep day", () => {
    const records = [
      {
        id: "old",
        bedtimeEnd: "2026-07-29T08:00:00-04:00",
      },
    ];

    expect(selectSleepForSleepDay(records, "2026-07-31")).toBeNull();
  });

  it("chooses the latest completed sleep within the target sleep day", () => {
    const records = [
      {
        id: "earlier",
        bedtimeEnd: "2026-07-31T07:30:00-04:00",
      },
      {
        id: "later",
        bedtimeEnd: "2026-07-31T09:00:00-04:00",
      },
      {
        id: "next-window",
        bedtimeEnd: "2026-07-31T18:30:00-04:00",
      },
    ];

    expect(selectSleepForSleepDay(records, "2026-07-31")?.id).toBe("later");
  });

  it("keeps a current sleep without stages instead of borrowing old stages", () => {
    const records = [
      {
        id: "current-without-stages",
        bedtimeEnd: "2026-07-31T08:00:00-04:00",
        hypnogram5min: null,
      },
      {
        id: "old-with-stages",
        bedtimeEnd: "2026-07-29T08:00:00-04:00",
        hypnogram5min: "1234",
      },
    ];

    expect(selectSleepForSleepDay(records, "2026-07-31")).toMatchObject({
      id: "current-without-stages",
      hypnogram5min: null,
    });
  });
});
