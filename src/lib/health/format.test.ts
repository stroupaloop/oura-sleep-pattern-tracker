import { describe, expect, it } from "vitest";
import {
  axisDayProps,
  currentEtHour,
  formatAxisDay,
  formatNightLabel,
  formatSyncedAt,
} from "./format";

describe("formatAxisDay", () => {
  it("names the month so a label is not mistaken for a count", () => {
    expect(formatAxisDay("2026-10-09")).toBe("Oct 9");
    expect(formatAxisDay("2026-01-05")).toBe("Jan 5");
  });

  it("adds the year when asked", () => {
    expect(formatAxisDay("2025-03-27", true)).toBe("Mar 27 ’25");
  });
});

describe("axisDayProps", () => {
  it("leaves the year off an axis inside one year", () => {
    const { tickFormatter } = axisDayProps([
      "2026-01-01",
      "2026-06-15",
      "2026-10-09",
    ]);
    expect(tickFormatter("2026-06-15")).toBe("Jun 15");
  });

  it("puts the year on every label once the days span two, and leaves more room for them", () => {
    const within = axisDayProps(["2026-01-01", "2026-10-09"]);
    const across = axisDayProps(["2025-12-20", "2026-01-10"]);
    expect(across.tickFormatter("2025-12-20")).toBe("Dec 20 ’25");
    expect(across.tickFormatter("2026-01-10")).toBe("Jan 10 ’26");
    expect(across.minTickGap).toBeGreaterThan(within.minTickGap);
  });

  it("keeps the first and last label however crowded the axis is", () => {
    expect(axisDayProps(["2026-10-01", "2026-10-09"]).interval).toBe(
      "preserveStartEnd"
    );
  });

  it("copes with no days", () => {
    expect(axisDayProps([]).tickFormatter("2026-10-09")).toBe("Oct 9");
  });
});

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
