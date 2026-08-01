import { describe, expect, it } from "vitest";

import {
  encodeSleepTimeOffset,
  getSleepTimeClockMinutes,
} from "./sleep-time";

describe("Oura sleep-time storage", () => {
  it("stores the Oura day timezone with each bedtime offset", () => {
    expect(encodeSleepTimeOffset(-3600, -7 * 3600)).toBe(
      '{"v":1,"day_tz":-25200,"offset":-3600}'
    );
  });

  it("does not store an offset without Oura timezone provenance", () => {
    expect(encodeSleepTimeOffset(-3600, null)).toBeNull();
    expect(encodeSleepTimeOffset(null, -7 * 3600)).toBeNull();
  });
});

describe("getSleepTimeClockMinutes", () => {
  it("converts an Oura local-day offset to Eastern Time", () => {
    const stored = encodeSleepTimeOffset(-3600, -7 * 3600);

    expect(getSleepTimeClockMinutes("2026-07-30", stored)).toBe(
      2 * 60
    );
  });

  it("uses the target zone rules on daylight-saving transition days", () => {
    const beforeSpringForward = encodeSleepTimeOffset(
      90 * 60,
      0
    );
    const afterSpringForward = encodeSleepTimeOffset(
      7.5 * 60 * 60,
      0
    );

    expect(
      getSleepTimeClockMinutes("2026-03-08", beforeSpringForward)
    ).toBe(20 * 60 + 30);
    expect(
      getSleepTimeClockMinutes("2026-03-08", afterSpringForward)
    ).toBe(3 * 60 + 30);
  });

  it("treats legacy plain-number values as unavailable", () => {
    expect(
      getSleepTimeClockMinutes("2026-07-30", "-3600")
    ).toBeNull();
  });

  it("rejects malformed storage and invalid calendar dates", () => {
    expect(
      getSleepTimeClockMinutes("2026-07-30", '{"v":2}')
    ).toBeNull();
    expect(
      getSleepTimeClockMinutes(
        "2026-02-30",
        encodeSleepTimeOffset(-3600, -5 * 3600)
      )
    ).toBeNull();
    expect(
      getSleepTimeClockMinutes(
        "2026-07-30",
        `{"v":1,"day_tz":0,"offset":${Number.MAX_SAFE_INTEGER}}`
      )
    ).toBeNull();
  });
});
