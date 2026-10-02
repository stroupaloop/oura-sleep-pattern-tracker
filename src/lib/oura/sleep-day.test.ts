import { describe, expect, it } from "vitest";
import {
  getOuraSleepDayForTimestamp,
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

  it("uses the ET sleep day when travel changes the timestamp calendar date", () => {
    expect(
      getOuraSleepDayForTimestamp("2026-08-01T05:30:00+09:00")
    ).toBe("2026-07-31");
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
