import { describe, expect, it } from "vitest";
import { etInputValueToUnix, unixToEtInputValue } from "./date-utils";

describe("datetime-local round trip in app time", () => {
  it("renders a summer (EDT) instant as wall clock", () => {
    const ts = Date.parse("2026-07-15T18:30:00Z") / 1000;
    expect(unixToEtInputValue(ts)).toBe("2026-07-15T14:30");
  });

  it("renders a winter (EST) instant as wall clock", () => {
    const ts = Date.parse("2026-01-15T18:30:00Z") / 1000;
    expect(unixToEtInputValue(ts)).toBe("2026-01-15T13:30");
  });

  it("parses wall clock back to the same instant, both seasons", () => {
    for (const iso of ["2026-07-15T18:30:00Z", "2026-01-15T18:30:00Z"]) {
      const ts = Date.parse(iso) / 1000;
      const value = unixToEtInputValue(ts)!;
      expect(etInputValueToUnix(value)).toBe(ts);
    }
  });

  it("handles midnight and end of day", () => {
    const ts = etInputValueToUnix("2026-09-25T00:00")!;
    expect(unixToEtInputValue(ts)).toBe("2026-09-25T00:00");
    const ts2 = etInputValueToUnix("2026-09-25T23:59")!;
    expect(unixToEtInputValue(ts2)).toBe("2026-09-25T23:59");
  });

  it("rejects malformed input", () => {
    expect(etInputValueToUnix("nope")).toBeNull();
    expect(etInputValueToUnix("2026-09-25")).toBeNull();
    expect(etInputValueToUnix("2026-09-25T25:00")).toBeNull();
    expect(unixToEtInputValue(Number.NaN)).toBeNull();
  });
});
