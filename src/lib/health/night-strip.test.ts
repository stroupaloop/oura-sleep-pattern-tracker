import { describe, expect, it } from "vitest";
import {
  buildNightStrip,
  describeShortNightRun,
  shortNightRun,
  SHORT_NIGHT_Z,
  type RunNight,
  type StripNight,
} from "./night-strip";

const USUAL = {
  bedtimeMinutes: 23 * 60,
  wakeMinutes: 7 * 60,
  sleepMinutes: 420,
  sleepZ: 0.1,
};

function night(
  bed: string,
  wake: string,
  overrides: Partial<StripNight> = {}
): StripNight {
  return {
    periods: [{ bedtimeStart: bed, bedtimeEnd: wake, hypnogram5min: null }],
    asleepMinutes: 420,
    usual: USUAL,
    ...overrides,
  };
}

const NIGHTS: Record<string, StripNight> = {
  "2026-10-06": night("2026-10-05T23:00:00-04:00", "2026-10-06T07:00:00-04:00"),
  "2026-10-05": night("2026-10-04T23:30:00-04:00", "2026-10-05T07:30:00-04:00"),
  "2026-10-03": night("2026-10-03T00:30:00-04:00", "2026-10-03T08:30:00-04:00"),
};
const DAYS = ["2026-10-06", "2026-10-05", "2026-10-04", "2026-10-03"];

describe("buildNightStrip", () => {
  const strip = buildNightStrip(DAYS, (day) => NIGHTS[day] ?? null, 1.5)!;
  const row = (day: string) => strip.rows.find((entry) => entry.day === day)!;

  it("puts every night on one axis that starts and ends on the hour", () => {
    expect(strip.span % 60).toBe(0);
    for (const entry of strip.rows.filter((r) => r.recorded)) {
      expect(entry.bar!.start).toBeGreaterThanOrEqual(0);
      expect(entry.bar!.end).toBeLessThanOrEqual(strip.span);
    }
    for (const tick of strip.ticks) {
      expect(tick.at).toBeGreaterThanOrEqual(0);
      expect(tick.at).toBeLessThanOrEqual(strip.span);
    }
  });

  it("keeps a bedtime after midnight to the right of an earlier one, not wrapped to the left", () => {
    const late = row("2026-10-03").bar!;
    const early = row("2026-10-06").bar!;
    expect(late.start - early.start).toBeCloseTo(90, 5);
    expect(late.end - late.start).toBeCloseTo(480, 5);
    expect(early.end - early.start).toBeCloseTo(480, 5);
  });

  it("draws her usual window on the same axis for each night", () => {
    const usual = row("2026-10-06").usual!;
    const bar = row("2026-10-06").bar!;
    expect(usual.end - usual.start).toBeCloseTo(480, 5);
    expect(usual.start).toBeCloseTo(bar.start, 5);
  });

  it("leaves a night with nothing recorded as a labelled gap, never a bar", () => {
    expect(row("2026-10-04")).toMatchObject({
      recorded: false,
      bar: null,
      usual: null,
      asleep: null,
      comparison: null,
    });
    expect(strip.rows.map((entry) => entry.day)).toEqual(DAYS);
  });

  it("labels the ticks on the clock", () => {
    expect(strip.ticks.map((tick) => tick.label)).toContain("10 PM");
    expect(strip.ticks.every((tick, index, all) => index === 0 || tick.at > all[index - 1].at)).toBe(true);
  });

  it("is null when no night in the range was recorded", () => {
    expect(buildNightStrip(DAYS, () => null, 1.5)).toBeNull();
  });

  it("names the times a screen reader needs", () => {
    expect(row("2026-10-06")).toMatchObject({
      bedtimeLabel: "11:00 PM",
      wakeLabel: "7:00 AM",
      asleep: "7h 0m",
    });
  });

  it("keeps the wall-clock wake time across a clock change, though the night ran an hour longer", () => {
    const fallBack = buildNightStrip(
      ["2026-11-01"],
      () => night("2026-10-31T23:00:00-04:00", "2026-11-01T07:00:00-05:00"),
      1.5
    )!.rows[0];
    expect(fallBack.wakeLabel).toBe("7:00 AM");
    expect(fallBack.bar!.end - fallBack.bar!.start).toBeCloseTo(540, 5);
  });

  it("draws the stretches of a night that came in pieces", () => {
    const pieces = buildNightStrip(
      ["2026-10-06"],
      () => ({
        ...night("2026-10-05T23:00:00-04:00", "2026-10-06T07:00:00-04:00"),
        periods: [
          { bedtimeStart: "2026-10-05T23:00:00-04:00", bedtimeEnd: "2026-10-06T03:00:00-04:00", hypnogram5min: null },
          { bedtimeStart: "2026-10-06T04:00:00-04:00", bedtimeEnd: "2026-10-06T07:00:00-04:00", hypnogram5min: null },
        ],
      }),
      1.5
    )!.rows[0];
    expect(pieces.bar!.stretches).toHaveLength(2);
    expect(pieces.bar!.stretches[1].start - pieces.bar!.stretches[0].end).toBeCloseTo(60, 5);
    expect(pieces.bar!.end - pieces.bar!.start).toBeCloseTo(480, 5);
  });

  describe("the comparison beside each night", () => {
    const compare = (asleepMinutes: number, sleepZ: number | null, sleepMinutes = 420) =>
      buildNightStrip(
        ["2026-10-06"],
        () =>
          night("2026-10-05T23:00:00-04:00", "2026-10-06T07:00:00-04:00", {
            asleepMinutes,
            usual: { ...USUAL, sleepMinutes, sleepZ },
          }),
        1.5
      )!.rows[0];

    it("says how much less, and marks only a threshold crossing as unusual", () => {
      expect(compare(320, -2.3)).toMatchObject({ comparison: "1h 40m less", level: "unusual" });
      expect(compare(370, -1.1)).toMatchObject({ comparison: "50m less", level: "outside" });
    });

    it("says how much more", () => {
      expect(compare(480, 1.2)).toMatchObject({ comparison: "1h 0m more", level: "outside" });
    });

    it("calls a night near her usual about usual", () => {
      expect(compare(415, -0.1)).toMatchObject({ comparison: "About usual", level: "usual" });
    });

    it("says so when there is no baseline yet, with no level to color", () => {
      expect(compare(415, null)).toMatchObject({ comparison: "No baseline yet", level: "unknown" });
    });
  });
});

describe("shortNightRun", () => {
  const short = (asleep: number, usual = 420): RunNight => ({
    recorded: true,
    asleepMinutes: asleep,
    usualMinutes: usual,
    sleepZ: SHORT_NIGHT_Z - 0.5,
  });
  const usual = (asleep = 420): RunNight => ({
    recorded: true,
    asleepMinutes: asleep,
    usualMinutes: 420,
    sleepZ: 0,
  });
  const missing: RunNight = {
    recorded: false,
    asleepMinutes: null,
    usualMinutes: null,
    sleepZ: null,
  };

  it("counts short nights back from the latest and adds up how short they were", () => {
    expect(shortNightRun([short(350), short(380), short(300), usual()])).toEqual({
      nights: 3,
      minutesShort: 70 + 40 + 120,
      endedByGap: false,
    });
  });

  it("is null when the latest night is not short", () => {
    expect(shortNightRun([usual(), short(300), short(300)])).toBeNull();
  });

  it("counts a night exactly one standard deviation below as short, and one just above as not", () => {
    const edge = (sleepZ: number): RunNight => ({ ...short(360), sleepZ });
    expect(shortNightRun([edge(-1)])?.nights).toBe(1);
    expect(shortNightRun([edge(-0.99)])).toBeNull();
  });

  it("stops at a night with nothing recorded and says the run may be longer", () => {
    expect(shortNightRun([short(350), short(350), missing, short(350)])).toEqual({
      nights: 2,
      minutesShort: 140,
      endedByGap: true,
    });
  });

  it("does not call a gap on the latest night a run", () => {
    expect(shortNightRun([missing, short(350)])).toBeNull();
  });

  it("stops at a night that cannot be judged because it has no baseline", () => {
    const unjudged: RunNight = { recorded: true, asleepMinutes: 300, usualMinutes: null, sleepZ: null };
    expect(shortNightRun([short(350), unjudged, short(350)])).toMatchObject({
      nights: 1,
      endedByGap: false,
    });
  });
});

describe("describeShortNightRun", () => {
  it("counts the nights in a row and the sleep lost in total", () => {
    expect(describeShortNightRun({ nights: 3, minutesShort: 185, endedByGap: false })).toBe(
      "3rd night in a row shorter than usual · 3h 5m less sleep in total"
    );
  });

  it("says when the night before is not recorded", () => {
    expect(describeShortNightRun({ nights: 2, minutesShort: 90, endedByGap: true })).toBe(
      "2nd night in a row shorter than usual · 1h 30m less sleep in total · the night before isn't recorded"
    );
  });

  it("uses the right ordinal ending", () => {
    const nth = (nights: number) =>
      describeShortNightRun({ nights, minutesShort: 60, endedByGap: false }).split(" ")[0];
    expect([2, 3, 4, 11, 12, 13, 21, 22].map(nth)).toEqual([
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
    ]);
  });
});
