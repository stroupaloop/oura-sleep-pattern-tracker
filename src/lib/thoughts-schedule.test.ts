import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEDULE_OPTIONS,
  duePlannedThoughts,
  etWallClockToUnix,
  planThoughtsForDay,
  unixToEtDay,
} from "./thoughts-schedule";

const OPTS = { ...DEFAULT_SCHEDULE_OPTIONS, seed: "test-secret" };

describe("etWallClockToUnix", () => {
  it("resolves a winter (EST, UTC-5) wall clock", () => {
    const ts = etWallClockToUnix("2026-01-15", 9 * 60);
    expect(ts).toBe(Date.parse("2026-01-15T14:00:00Z") / 1000);
  });

  it("resolves a summer (EDT, UTC-4) wall clock", () => {
    const ts = etWallClockToUnix("2026-07-15", 9 * 60);
    expect(ts).toBe(Date.parse("2026-07-15T13:00:00Z") / 1000);
  });

  it("rolls past midnight when minutes exceed a day", () => {
    const ts = etWallClockToUnix("2026-07-15", 24 * 60 + 30);
    expect(ts).toBe(Date.parse("2026-07-16T04:30:00Z") / 1000);
    expect(unixToEtDay(ts!)).toBe("2026-07-16");
  });

  it("rejects a malformed day", () => {
    expect(etWallClockToUnix("not-a-day", 60)).toBeNull();
  });
});

describe("planThoughtsForDay", () => {
  it("is deterministic for a given day and seed", () => {
    const a = planThoughtsForDay("2026-09-25", OPTS);
    const b = planThoughtsForDay("2026-09-25", OPTS);
    expect(a).toEqual(b);
  });

  it("differs across days", () => {
    const a = planThoughtsForDay("2026-09-25", OPTS);
    const b = planThoughtsForDay("2026-09-26", OPTS);
    expect(a.map((e) => e.slot)).not.toEqual(b.map((e) => e.slot));
  });

  it("differs across seeds", () => {
    const a = planThoughtsForDay("2026-09-25", OPTS);
    const b = planThoughtsForDay("2026-09-25", { ...OPTS, seed: "other" });
    expect(a.map((e) => e.createdAt)).not.toEqual(b.map((e) => e.createdAt));
  });

  it("honours the configured count range across many days", () => {
    for (let i = 1; i <= 28; i++) {
      const day = `2026-09-${String(i).padStart(2, "0")}`;
      const planned = planThoughtsForDay(day, OPTS);
      expect(planned.length).toBeGreaterThanOrEqual(OPTS.min);
      expect(planned.length).toBeLessThanOrEqual(OPTS.max);
    }
  });

  it("keeps every entry inside the 7am-1am window", () => {
    for (let i = 1; i <= 28; i++) {
      const day = `2026-09-${String(i).padStart(2, "0")}`;
      for (const entry of planThoughtsForDay(day, OPTS)) {
        const minutesFromWindowStart =
          entry.createdAt - etWallClockToUnix(day, OPTS.startHour * 60)!;
        expect(minutesFromWindowStart).toBeGreaterThanOrEqual(0);
        expect(minutesFromWindowStart).toBeLessThan(
          (OPTS.endHour - OPTS.startHour) * 3600
        );
      }
    }
  });

  it("spaces entries by at least the minimum gap", () => {
    for (let i = 1; i <= 28; i++) {
      const day = `2026-09-${String(i).padStart(2, "0")}`;
      const planned = planThoughtsForDay(day, OPTS);
      for (let j = 1; j < planned.length; j++) {
        expect(planned[j].createdAt - planned[j - 1].createdAt).toBeGreaterThanOrEqual(
          OPTS.minGapMinutes * 60
        );
      }
    }
  });

  it("issues unique, day-scoped slot keys", () => {
    const planned = planThoughtsForDay("2026-09-25", OPTS);
    const slots = planned.map((entry) => entry.slot);
    expect(new Set(slots).size).toBe(slots.length);
    for (const slot of slots) expect(slot.startsWith("2026-09-25#")).toBe(true);
  });

  it("labels a post-midnight entry with the next calendar day", () => {
    const planned = planThoughtsForDay("2026-09-25", {
      ...OPTS,
      min: 1,
      max: 1,
      startHour: 24.5,
      endHour: 25,
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].day).toBe("2026-09-26");
    expect(planned[0].slot).toBe("2026-09-25#0");
  });

  it("returns nothing for an empty window", () => {
    expect(
      planThoughtsForDay("2026-09-25", { ...OPTS, startHour: 10, endHour: 10 })
    ).toEqual([]);
  });
});

describe("duePlannedThoughts", () => {
  it("returns only entries whose time has passed", () => {
    const planned = planThoughtsForDay("2026-09-25", OPTS);
    const cutoff = planned[0].createdAt;
    const due = duePlannedThoughts(planned, cutoff);
    expect(due).toHaveLength(1);
    expect(due[0].slot).toBe(planned[0].slot);
  });

  it("returns everything once the day is over", () => {
    const planned = planThoughtsForDay("2026-09-25", OPTS);
    const after = etWallClockToUnix("2026-09-26", 12 * 60)!;
    expect(duePlannedThoughts(planned, after)).toHaveLength(planned.length);
  });
});
