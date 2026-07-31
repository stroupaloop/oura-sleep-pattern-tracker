import { describe, expect, it } from "vitest";
import {
  formatIsoDay,
  formatIsoTimeInAppTimeZone,
  getDayOffsetClockMinutes,
  getIsoTimeZoneClockMinutes,
  shiftIsoDay,
} from "./date-utils";

describe("Oura timestamp presentation", () => {
  it("converts localized Oura timestamps to the app ET policy", () => {
    const timestamp = "2026-07-30T23:15:00-07:00";

    expect(getIsoTimeZoneClockMinutes(timestamp)).toBe(2 * 60 + 15);
    expect(formatIsoTimeInAppTimeZone(timestamp)).toBe("2:15 AM");
  });

  it("does not invent a time for invalid or timezone-free timestamps", () => {
    expect(getIsoTimeZoneClockMinutes("not-a-timestamp")).toBeNull();
    expect(formatIsoTimeInAppTimeZone("not-a-timestamp")).toBeNull();
    expect(
      getIsoTimeZoneClockMinutes("2026-07-30T23:15:00")
    ).toBeNull();
  });
});

describe("getDayOffsetClockMinutes", () => {
  it("converts an Oura local-day offset into ET using the source offset", () => {
    expect(
      getDayOffsetClockMinutes(
        "2026-07-30",
        -60 * 60,
        "2026-07-29T23:00:00-07:00"
      )
    ).toBe(2 * 60);
  });

  it("rejects an offset without source timezone provenance", () => {
    expect(
      getDayOffsetClockMinutes(
        "2026-07-30",
        -60 * 60,
        "2026-07-29T23:00:00"
      )
    ).toBeNull();
  });
});

describe("formatIsoDay", () => {
  it("formats a date-only Oura day without runtime timezone drift", () => {
    expect(formatIsoDay("2024-02-29")).toBe("Feb 29, 2024");
  });

  it("rejects invalid calendar dates", () => {
    expect(formatIsoDay("2026-02-30")).toBeNull();
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
