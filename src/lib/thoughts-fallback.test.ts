import { describe, expect, it } from "vitest";
import { getIsoTimeZoneClockMinutes } from "./date-utils";
import {
  DEFAULT_FALLBACK_OPTIONS,
  fallbackDueAt,
  fallbackPingDue,
  isWakingTime,
} from "./thoughts-fallback";

const OPTIONS = { ...DEFAULT_FALLBACK_OPTIONS, seed: "test-seed" };
const HOUR = 3600;

function etMinutes(unixSeconds: number): number {
  return getIsoTimeZoneClockMinutes(new Date(unixSeconds * 1000).toISOString())!;
}

// 10:00 AM ET on Mon Sep 28 2026 (EDT, UTC-4).
const MORNING = Date.parse("2026-09-28T14:00:00Z") / 1000;
// 9:30 PM ET the same day.
const LATE_EVENING = Date.parse("2026-09-29T01:30:00Z") / 1000;

describe("fallbackDueAt", () => {
  it("is the same on every call for one activity time", () => {
    expect(fallbackDueAt(MORNING, OPTIONS)).toBe(fallbackDueAt(MORNING, OPTIONS));
  });

  it("changes with the activity time and the seed", () => {
    const base = fallbackDueAt(MORNING, OPTIONS);
    expect(fallbackDueAt(MORNING + 60, OPTIONS)).not.toBe(base);
    expect(fallbackDueAt(MORNING, { ...OPTIONS, seed: "other" })).not.toBe(base);
  });

  it("waits 6-12 hours and only lands in waking hours, over three days of activity times", () => {
    for (let t = MORNING; t < MORNING + 72 * HOUR; t += 17 * 60) {
      const due = fallbackDueAt(t, OPTIONS)!;
      const minutes = etMinutes(due);
      expect(due - t).toBeGreaterThanOrEqual(6 * HOUR);
      expect(minutes).toBeGreaterThanOrEqual(8 * 60);
      expect(minutes).toBeLessThan(22 * 60);
      // Longer than 12 hours only when pushed out of the night into the morning.
      if (due - t > 12 * HOUR) {
        expect(minutes).toBeLessThan(8 * 60 + 90);
      }
    }
  });

  it("moves a late-evening quiet stretch to the next morning", () => {
    const due = fallbackDueAt(LATE_EVENING, OPTIONS)!;
    const minutes = etMinutes(due);
    expect(minutes).toBeGreaterThanOrEqual(8 * 60);
    expect(minutes).toBeLessThan(8 * 60 + 90);
    expect(new Date(due * 1000).toISOString().slice(0, 10)).toBe("2026-09-29");
  });
});

describe("fallbackPingDue", () => {
  it("does nothing with no activity at all, or before the due time", () => {
    expect(fallbackPingDue(null, MORNING, OPTIONS)).toBeNull();
    const due = fallbackDueAt(MORNING, OPTIONS)!;
    expect(fallbackPingDue(MORNING, due - 1, OPTIONS)).toBeNull();
  });

  it("keeps the random due minute when the tick comes shortly after it", () => {
    const due = fallbackDueAt(MORNING, OPTIONS)!;
    expect(fallbackPingDue(MORNING, due + 9 * 60, OPTIONS)).toEqual({
      createdAt: due,
      slot: `fallback:${MORNING}`,
    });
  });

  it("stamps a long-missed ping with the current time instead of the past", () => {
    const due = fallbackDueAt(MORNING, OPTIONS)!;
    // Two days on, at 11:00 AM ET.
    const now = Date.parse("2026-09-30T15:00:00Z") / 1000;
    expect(now - due).toBeGreaterThan(OPTIONS.maxBackdateSeconds);
    expect(fallbackPingDue(MORNING, now, OPTIONS)?.createdAt).toBe(now);
  });

  it("holds a long-missed ping overnight rather than sending it at night", () => {
    // 3:00 AM ET, long after the due time.
    const now = Date.parse("2026-09-30T07:00:00Z") / 1000;
    expect(isWakingTime(now, OPTIONS)).toBe(false);
    expect(fallbackPingDue(MORNING, now, OPTIONS)).toBeNull();
  });
});
