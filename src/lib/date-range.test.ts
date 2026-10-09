import { describe, expect, it } from "vitest";
import {
  checkCustomRange,
  daysBetween,
  describeDateRange,
  filterToDateRange,
  inDateRange,
  isIsoDay,
  MAX_RANGE_DAYS,
  presetsFor,
  resolveDateRange,
  withRange,
} from "./date-range";

const TODAY = "2026-10-09";
const options = { today: TODAY, defaultToken: "90d" };

describe("resolveDateRange: relative", () => {
  it("falls back to the page's default, counting today as the last day", () => {
    expect(resolveDateRange({}, options)).toEqual({
      kind: "relative",
      token: "90d",
      start: "2026-07-12",
      end: TODAY,
      days: 90,
    });
    expect(resolveDateRange({}, { ...options, defaultToken: "30d" }).start).toBe(
      "2026-09-10"
    );
  });

  it("reads a preset, a bare number of days (the old Life chart links) and years", () => {
    expect(resolveDateRange({ range: "14d" }, options)).toMatchObject({
      token: "14d",
      days: 14,
      start: "2026-09-26",
    });
    expect(resolveDateRange({ range: "30" }, options)).toMatchObject({
      token: "30d",
      days: 30,
    });
    expect(resolveDateRange({ range: "365" }, options)).toMatchObject({
      token: "1y",
      days: 365,
    });
    expect(resolveDateRange({ range: "1y" }, options)).toMatchObject({
      token: "1y",
      days: 365,
    });
    expect(resolveDateRange({ range: "2y" }, options)).toMatchObject({
      token: "730d",
      days: 730,
    });
    expect(resolveDateRange({ range: "45" }, options)).toMatchObject({
      token: "45d",
      days: 45,
    });
  });

  it("is not thrown by case, spaces or repeated parameters", () => {
    expect(resolveDateRange({ range: " 30D " }, options).token).toBe("30d");
    expect(resolveDateRange({ range: ["14d", "30d"] }, options).token).toBe("14d");
  });

  it("ignores anything that is not a range", () => {
    for (const range of ["banana", "0", "-5", "99999", "11y", "1.5", "d", ""]) {
      expect(resolveDateRange({ range }, options)).toMatchObject({
        token: "90d",
        days: 90,
      });
    }
  });

  it("accepts the longest range and no more", () => {
    expect(resolveDateRange({ range: "10y" }, options).days).toBe(MAX_RANGE_DAYS);
    expect(resolveDateRange({ range: "3651" }, options).days).toBe(90);
  });

  it("ignores all-time on a page that cannot draw it", () => {
    expect(
      resolveDateRange({ range: "all" }, { ...options, allowAll: false })
    ).toMatchObject({ kind: "relative", token: "90d", days: 90 });
  });

  it("starts all-time at the first day on record, or at nothing when none is known", () => {
    expect(
      resolveDateRange({ range: "all" }, { ...options, earliest: "2025-03-27" })
    ).toEqual({
      kind: "all",
      token: "all",
      start: "2025-03-27",
      end: TODAY,
      days: 562,
    });
    expect(resolveDateRange({ range: "all" }, options)).toEqual({
      kind: "all",
      token: "all",
      start: null,
      end: TODAY,
      days: null,
    });
    expect(
      resolveDateRange({ range: "all" }, { ...options, earliest: "not a day" }).start
    ).toBeNull();
  });
});

describe("resolveDateRange: dates", () => {
  it("shows exactly the days asked for, both ends included", () => {
    expect(
      resolveDateRange({ from: "2026-07-01", to: "2026-07-31" }, options)
    ).toEqual({
      kind: "absolute",
      token: null,
      start: "2026-07-01",
      end: "2026-07-31",
      days: 31,
    });
  });

  it("lets dates win over a range, and reads start and end as from and to", () => {
    expect(
      resolveDateRange({ range: "7d", from: "2026-07-01", to: "2026-07-31" }, options)
        .kind
    ).toBe("absolute");
    expect(
      resolveDateRange({ start: "2026-07-01", end: "2026-07-31" }, options)
    ).toMatchObject({ start: "2026-07-01", end: "2026-07-31" });
    expect(
      resolveDateRange({ from: "2026-06-01", start: "2026-07-01", to: "2026-07-31" }, options)
        .start
    ).toBe("2026-06-01");
  });

  it("ends today when only a start is given", () => {
    expect(resolveDateRange({ from: "2026-09-29" }, options)).toMatchObject({
      start: "2026-09-29",
      end: TODAY,
      days: 11,
    });
  });

  it("reaches back by the default length from an end alone", () => {
    expect(resolveDateRange({ to: "2026-08-31" }, options)).toMatchObject({
      start: "2026-06-03",
      end: "2026-08-31",
      days: 90,
    });
  });

  it("swaps a start that comes after the end", () => {
    expect(
      resolveDateRange({ from: "2026-07-31", to: "2026-07-01" }, options)
    ).toMatchObject({ start: "2026-07-01", end: "2026-07-31" });
  });

  it("never reaches past today", () => {
    expect(
      resolveDateRange({ from: "2026-10-01", to: "2027-01-01" }, options)
    ).toMatchObject({ start: "2026-10-01", end: TODAY });
    expect(resolveDateRange({ from: "2027-01-01" }, options)).toMatchObject({
      start: TODAY,
      end: TODAY,
      days: 1,
    });
  });

  it("ignores a date that is not a day on the calendar", () => {
    expect(
      resolveDateRange({ from: "2026-02-30", to: "2026-13-01" }, options)
    ).toMatchObject({ kind: "relative", token: "90d" });
    expect(
      resolveDateRange({ from: "2026-02-30", to: "2026-08-31" }, options)
    ).toMatchObject({ kind: "absolute", end: "2026-08-31", days: 90 });
  });

  it("keeps the end of a window longer than the limit", () => {
    const range = resolveDateRange({ from: "2000-01-01", to: "2026-08-31" }, options);
    expect(range.end).toBe("2026-08-31");
    expect(range.days).toBe(MAX_RANGE_DAYS);
  });
});

describe("describeDateRange", () => {
  it("names the year once when both ends share it", () => {
    expect(
      describeDateRange(resolveDateRange({}, options))
    ).toBe("Jul 12 – Oct 9, 2026 · 90 days");
  });

  it("names both years when the range crosses one", () => {
    expect(
      describeDateRange(
        resolveDateRange({ from: "2025-03-27", to: "2026-10-09" }, options)
      )
    ).toBe("Mar 27, 2025 – Oct 9, 2026 · 562 days");
  });

  it("says a single day once", () => {
    expect(
      describeDateRange(resolveDateRange({ from: TODAY, to: TODAY }, options))
    ).toBe("Oct 9, 2026 · 1 day");
  });

  it("says all-time, with its dates when they are known", () => {
    expect(
      describeDateRange(
        resolveDateRange({ range: "all" }, { ...options, earliest: "2025-03-27" })
      )
    ).toBe("All time · Mar 27, 2025 – Oct 9, 2026 · 562 days");
    expect(describeDateRange(resolveDateRange({ range: "all" }, options))).toBe(
      "All time · through Oct 9, 2026"
    );
  });
});

describe("withRange", () => {
  it("replaces whatever range the address held and keeps the rest", () => {
    const current = new URLSearchParams("tab=sleep&range=30&start=2026-01-01&page=2");
    expect(withRange(current, { range: "90d" }).toString()).toBe(
      "tab=sleep&page=2&range=90d"
    );
    expect(
      withRange(new URLSearchParams("range=30d&tab=sleep"), {
        from: "2026-07-01",
        to: "2026-07-31",
      }).toString()
    ).toBe("tab=sleep&from=2026-07-01&to=2026-07-31");
  });

  it("does not change the address it was given", () => {
    const current = new URLSearchParams("range=30d");
    withRange(current, { range: "7d" });
    expect(current.toString()).toBe("range=30d");
  });
});

describe("checkCustomRange", () => {
  it("accepts a start on or before an end that is not in the future", () => {
    expect(checkCustomRange("2026-07-01", "2026-07-31", TODAY)).toBeNull();
    expect(checkCustomRange(TODAY, TODAY, TODAY)).toBeNull();
  });

  it("says what is wrong otherwise", () => {
    expect(checkCustomRange("", "2026-07-31", TODAY)).toMatch(/both a start and an end/);
    expect(checkCustomRange("2026-02-30", "2026-07-31", TODAY)).toMatch(/both a start and an end/);
    expect(checkCustomRange("2026-08-01", "2026-07-31", TODAY)).toMatch(/on or before/);
    expect(checkCustomRange("2026-07-01", "2026-10-10", TODAY)).toMatch(/future/);
    expect(checkCustomRange("2000-01-01", TODAY, TODAY)).toMatch(/ten years/);
  });
});

describe("day helpers", () => {
  it("counts days from one end to the other, both included", () => {
    expect(daysBetween("2026-07-01", "2026-07-01")).toBe(1);
    expect(daysBetween("2026-07-01", "2026-07-31")).toBe(31);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(2);
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(3);
  });

  it("knows a real day from a malformed or impossible one", () => {
    expect(isIsoDay("2026-02-28")).toBe(true);
    expect(isIsoDay("2024-02-29")).toBe(true);
    expect(isIsoDay("2026-02-29")).toBe(false);
    expect(isIsoDay("2026-2-9")).toBe(false);
    expect(isIsoDay(undefined)).toBe(false);
  });

  it("keeps the rows dated inside the range, edges included", () => {
    const rows = ["2026-07-11", "2026-07-12", "2026-10-09", "2026-10-10"].map(
      (day) => ({ day })
    );
    const range = resolveDateRange({}, options);
    expect(filterToDateRange(rows, range).map((row) => row.day)).toEqual([
      "2026-07-12",
      "2026-10-09",
    ]);
    expect(inDateRange("2020-01-01", resolveDateRange({ range: "all" }, options))).toBe(true);
    expect(inDateRange("2026-10-10", resolveDateRange({ range: "all" }, options))).toBe(false);
  });

  it("offers the presets a page names, in its order", () => {
    expect(presetsFor(["30d", "all", "nonsense", "7d"]).map((p) => p.value)).toEqual([
      "30d",
      "all",
      "7d",
    ]);
    expect(presetsFor(["1y"])[0]).toMatchObject({ days: 365, label: "1y", spoken: "1 year" });
  });
});
