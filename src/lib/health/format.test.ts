import { describe, expect, it } from "vitest";
import { currentEtHour, formatNightLabel, formatSyncedAt } from "./format";

describe("formatNightLabel", () => {
  it("names the evening and the morning of an Oura sleep day", () => {
    expect(formatNightLabel("2026-10-01")).toBe("Wed, Sep 30 → Thu, Oct 1");
    expect(formatNightLabel("2026-10-01", { weekday: false })).toBe(
      "Sep 30 → Oct 1"
    );
    expect(formatNightLabel("2026-03-01", { weekday: false })).toBe(
      "Feb 28 → Mar 1"
    );
  });
});

describe("formatSyncedAt", () => {
  const at = (iso: string) => Date.parse(iso) / 1000;

  it("gives just the time for today and adds the date otherwise", () => {
    expect(formatSyncedAt(at("2026-10-01T11:42:00Z"), "2026-10-01")).toBe(
      "7:42 AM"
    );
    expect(formatSyncedAt(at("2026-09-29T21:01:00Z"), "2026-10-01")).toBe(
      "Sep 29, 5:01 PM"
    );
  });
});

describe("currentEtHour", () => {
  it("reads the hour in Eastern time across DST", () => {
    expect(currentEtHour(new Date("2026-10-01T11:30:00Z"))).toBe(7);
    expect(currentEtHour(new Date("2026-12-01T11:30:00Z"))).toBe(6);
    expect(currentEtHour(new Date("2026-10-02T03:59:00Z"))).toBe(23);
  });
});
