import { describe, expect, it } from "vitest";
import {
  formatIsoLocalTime,
  getIsoLocalClockMinutes,
  shiftIsoDay,
} from "./date-utils";

describe("Oura timestamp presentation", () => {
  it("preserves the wall clock encoded in a localized Oura timestamp", () => {
    const timestamp = "2026-07-30T23:15:00-07:00";

    expect(getIsoLocalClockMinutes(timestamp)).toBe(23 * 60 + 15);
    expect(formatIsoLocalTime(timestamp)).toBe("11:15 PM");
  });

  it("does not invent a time for an invalid timestamp", () => {
    expect(getIsoLocalClockMinutes("not-a-timestamp")).toBeNull();
    expect(formatIsoLocalTime("not-a-timestamp")).toBeNull();
  });
});

describe("shiftIsoDay", () => {
  it("shifts calendar dates without depending on the runtime timezone", () => {
    expect(shiftIsoDay("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftIsoDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("rejects invalid calendar dates", () => {
    expect(shiftIsoDay("2026-02-30", 1)).toBeNull();
  });
});
