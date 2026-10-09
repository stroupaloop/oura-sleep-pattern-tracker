import { circularMeanMinutes, minutesFromMidnight } from "@/lib/analysis/baseline";
import { formatClockMinutes, type NightWindowPeriod } from "./night-window";
import {
  ABOUT_USUAL_Z,
  formatMinutes,
  levelFor,
  type SignalLevel,
} from "./signals";

/** A recorded night as the strip needs it. */
export interface StripNight {
  periods: readonly NightWindowPeriod[];
  /** Total time asleep, in minutes. */
  asleepMinutes: number | null;
  /** Her usual for this night, from the stored analysis. */
  usual: {
    bedtimeMinutes: number | null;
    wakeMinutes: number | null;
    sleepMinutes: number | null;
    sleepZ: number | null;
  } | null;
}

export interface NightStripRow {
  day: string;
  recorded: boolean;
  /** The night on the shared axis; `stretches` are its separate periods. */
  bar: {
    start: number;
    end: number;
    stretches: Array<{ start: number; end: number }>;
  } | null;
  /** The window she usually sleeps in, on the same axis. */
  usual: { start: number; end: number } | null;
  bedtimeLabel: string | null;
  wakeLabel: string | null;
  /** "7h 28m". */
  asleep: string | null;
  /** "1h 10m less", "About usual", or why there is no comparison. */
  comparison: string | null;
  level: SignalLevel;
}

export interface NightStrip {
  /** Width of the axis in minutes; every position lies in [0, span]. */
  span: number;
  ticks: Array<{ at: number; label: string }>;
  rows: NightStripRow[];
}

const FALLBACK_BEDTIME = 23 * 60;

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function toClock(minutes: number): number {
  return ((minutes % 1440) + 1440) % 1440;
}

function wallClock(iso: string): number | null {
  const minutes = minutesFromMidnight(iso);
  return Number.isFinite(minutes) ? toClock(minutes) : null;
}

interface PlacedNight {
  startClock: number;
  /** The wall-clock wake time, which differs from start plus duration across a clock change. */
  endClock: number;
  durationMinutes: number;
  stretches: Array<{ offset: number; length: number }>;
}

function placeNight(periods: readonly NightWindowPeriod[]): PlacedNight | null {
  const ordered = periods
    .map((period) => ({
      startMs: Date.parse(period.bedtimeStart),
      endMs: Date.parse(period.bedtimeEnd),
      bedtimeStart: period.bedtimeStart,
      bedtimeEnd: period.bedtimeEnd,
    }))
    .filter(
      (period) =>
        Number.isFinite(period.startMs) &&
        Number.isFinite(period.endMs) &&
        period.endMs > period.startMs
    )
    .sort((left, right) => left.startMs - right.startMs);
  if (ordered.length === 0) return null;

  const first = ordered[0];
  const last = ordered.reduce((latest, period) =>
    period.endMs > latest.endMs ? period : latest
  );
  const startClock = wallClock(first.bedtimeStart);
  const endClock = wallClock(last.bedtimeEnd);
  if (startClock == null || endClock == null) return null;

  return {
    startClock,
    endClock,
    durationMinutes: (last.endMs - first.startMs) / 60_000,
    stretches: ordered.map((period) => ({
      offset: (period.startMs - first.startMs) / 60_000,
      length: (period.endMs - period.startMs) / 60_000,
    })),
  };
}

/**
 * The last nights, newest first, drawn on one clock axis under the window she
 * usually sleeps in, so drift in timing, length and regularity reads down the
 * column. Times are the ring's wall-clock times, as the baselines are. A night
 * with nothing recorded gets a row of its own and no bar, never a normal-looking
 * one. The axis starts on the hour before the earliest bedtime shown and ends
 * on the hour after the latest wake or usual wake.
 */
export function buildNightStrip(
  days: readonly string[],
  nightFor: (day: string) => StripNight | null,
  threshold: number
): NightStrip | null {
  const entries = days.map((day) => {
    const night = nightFor(day);
    const placed = night ? placeNight(night.periods) : null;
    return { day, night, placed };
  });
  if (!entries.some((entry) => entry.placed)) return null;

  // Bedtimes sit about six hours after the axis origin, so a night that runs
  // late past midnight stays on the same side of it as an early one.
  const clocks = entries.flatMap((entry) => [
    ...(entry.placed ? [entry.placed.startClock] : []),
    ...(finite(entry.night?.usual?.bedtimeMinutes)
      ? [toClock(entry.night!.usual!.bedtimeMinutes!)]
      : []),
  ]);
  const meanBedtime = circularMeanMinutes(clocks);
  const origin = toClock(
    (Number.isFinite(meanBedtime) ? meanBedtime : FALLBACK_BEDTIME) - 360
  );

  const drawn = entries.map((entry) => {
    const placed = entry.placed;
    const usual = entry.night?.usual;
    const barStart = placed ? toClock(placed.startClock - origin) : null;
    const usualStart =
      finite(usual?.bedtimeMinutes) && finite(usual?.wakeMinutes)
        ? toClock(usual.bedtimeMinutes - origin)
        : null;
    const usualEnd =
      usualStart != null
        ? usualStart + toClock(usual!.wakeMinutes! - usual!.bedtimeMinutes!)
        : null;
    return { entry, barStart, usualStart, usualEnd };
  });

  const starts = drawn.flatMap(({ barStart, usualStart }) => [
    ...(barStart != null ? [barStart] : []),
    ...(usualStart != null ? [usualStart] : []),
  ]);
  const ends = drawn.flatMap(({ entry, barStart, usualEnd }) => [
    ...(entry.placed && barStart != null
      ? [barStart + entry.placed.durationMinutes]
      : []),
    ...(usualEnd != null ? [usualEnd] : []),
  ]);
  const axisStart = Math.floor((origin + Math.min(...starts) - 30) / 60) * 60;
  const axisEnd = Math.ceil((origin + Math.max(...ends) + 30) / 60) * 60;
  const span = axisEnd - axisStart;
  const at = (position: number) => origin + position - axisStart;

  const step = span <= 12 * 60 ? 120 : 180;
  const ticks: NightStrip["ticks"] = [];
  for (
    let clock = Math.ceil(axisStart / step) * step;
    clock <= axisEnd;
    clock += step
  ) {
    ticks.push({ at: clock - axisStart, label: formatClockMinutes(clock, "short") });
  }

  const rows = drawn.map(({ entry, barStart, usualStart, usualEnd }): NightStripRow => {
    const { day, night, placed } = entry;
    if (!night || !placed || barStart == null) {
      return {
        day,
        recorded: false,
        bar: null,
        usual: null,
        bedtimeLabel: null,
        wakeLabel: null,
        asleep: null,
        comparison: null,
        level: "unknown",
      };
    }

    const usual = night.usual;
    const hasBaseline = finite(usual?.sleepMinutes) && finite(usual?.sleepZ);
    const asleep = night.asleepMinutes;
    const level = hasBaseline ? levelFor(usual!.sleepZ, threshold) : "unknown";
    const comparison = !hasBaseline
      ? "No baseline yet"
      : !finite(asleep)
        ? null
        : Math.abs(usual!.sleepZ!) < ABOUT_USUAL_Z
          ? "About usual"
          : `${formatMinutes(asleep - usual!.sleepMinutes!)} ${
              asleep >= usual!.sleepMinutes! ? "more" : "less"
            }`;

    return {
      day,
      recorded: true,
      bar: {
        start: at(barStart),
        end: at(barStart + placed.durationMinutes),
        stretches: placed.stretches.map((stretch) => ({
          start: at(barStart + stretch.offset),
          end: at(barStart + stretch.offset + stretch.length),
        })),
      },
      usual:
        usualStart != null && usualEnd != null
          ? { start: at(usualStart), end: at(usualEnd) }
          : null,
      bedtimeLabel: formatClockMinutes(placed.startClock),
      wakeLabel: formatClockMinutes(placed.endClock),
      asleep: finite(asleep) ? formatMinutes(asleep) : null,
      comparison,
      level,
    };
  });

  return { span, ticks, rows };
}

/** A night counts as short when it falls this many standard deviations below her usual. */
export const SHORT_NIGHT_Z = -1;

export interface RunNight {
  recorded: boolean;
  asleepMinutes: number | null;
  usualMinutes: number | null;
  sleepZ: number | null;
}

export interface ShortNightRun {
  /** Short nights in a row, ending with the latest. */
  nights: number;
  /** How much less than usual she slept across them, in minutes. */
  minutesShort: number;
  /** The run reaches a night with nothing recorded, so it may be longer. */
  endedByGap: boolean;
}

/**
 * Short nights in a row, counted back from the latest. A night is short when
 * it sits a standard deviation or more below her usual; the run stops at the
 * first night that does not, and says so when that is because nothing was
 * recorded rather than because she slept enough.
 */
export function shortNightRun(
  newestFirst: readonly RunNight[]
): ShortNightRun | null {
  let nights = 0;
  let minutesShort = 0;
  let endedByGap = false;
  for (const night of newestFirst) {
    if (!night.recorded) {
      endedByGap = nights > 0;
      break;
    }
    const short =
      finite(night.sleepZ) &&
      night.sleepZ <= SHORT_NIGHT_Z &&
      finite(night.asleepMinutes) &&
      finite(night.usualMinutes);
    if (!short) break;
    nights++;
    minutesShort += Math.max(0, night.usualMinutes! - night.asleepMinutes!);
  }
  return nights > 0 ? { nights, minutesShort, endedByGap } : null;
}

function ordinal(count: number): string {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${count}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[count % 10] ?? "th";
  return `${count}${suffix}`;
}

/** "3rd night in a row shorter than usual · 3h 5m less sleep in total". */
export function describeShortNightRun(run: ShortNightRun): string {
  return [
    `${ordinal(run.nights)} night in a row shorter than usual`,
    `${formatMinutes(run.minutesShort)} less sleep in total`,
    ...(run.endedByGap ? ["the night before isn't recorded"] : []),
  ].join(" · ");
}
