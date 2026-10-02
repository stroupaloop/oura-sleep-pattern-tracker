import { minutesFromMidnight } from "@/lib/analysis/baseline";

export type NightStage = "deep" | "light" | "rem" | "awake" | "asleep";

const STAGE_BY_CODE: Record<string, NightStage> = {
  "1": "deep",
  "2": "light",
  "3": "rem",
  "4": "awake",
};

const HYPNOGRAM_STEP_MINUTES = 5;

export interface NightWindowPeriod {
  bedtimeStart: string;
  bedtimeEnd: string;
  hypnogram5min: string | null;
}

export interface NightWindow {
  /** Width of the axis in minutes; every position below lies in [0, span]. */
  span: number;
  segments: Array<{ start: number; end: number; stage: NightStage }>;
  bedtime: number;
  wake: number;
  /** Her usual bedtime and wake time on the same axis, when a baseline exists. */
  usual: { bedtime: number; wake: number } | null;
  ticks: Array<{ at: number; label: string }>;
  bedtimeLabel: string;
  wakeLabel: string;
}

function toClock(minutes: number): number {
  return ((minutes % 1440) + 1440) % 1440;
}

/** Signed minutes from `from` to `to` on a 24-hour clock, in (-720, 720]. */
function clockDifference(to: number, from: number): number {
  return toClock(to - from + 720) - 720;
}

/** "11:40 PM", or "11 PM" on the hour in `short` style. */
export function formatClockMinutes(
  minutes: number,
  style: "long" | "short" = "long"
): string {
  const clock = toClock(Math.round(minutes));
  const hours = Math.floor(clock / 60);
  const mins = clock % 60;
  const suffix = hours < 12 ? "AM" : "PM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  if (style === "short" && mins === 0) return `${hour12} ${suffix}`;
  return `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function wallClock(iso: string): number | null {
  const minutes = minutesFromMidnight(iso);
  return Number.isFinite(minutes) ? toClock(minutes) : null;
}

/**
 * Lays one night out on a clock-time axis next to her usual window. Times are
 * the ring's wall-clock times, as the baselines are, so "usual" means what
 * the pattern checks mean by it. Positions count minutes from the axis start,
 * which falls on the hour before the earlier of the two bedtimes.
 */
export function buildNightWindow(
  periods: readonly NightWindowPeriod[],
  usual: { bedtimeMinutes: number | null; wakeMinutes: number | null } | null
): NightWindow | null {
  const ordered = periods
    .map((period) => ({
      ...period,
      startMs: Date.parse(period.bedtimeStart),
      endMs: Date.parse(period.bedtimeEnd),
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
  const bedClock = wallClock(first.bedtimeStart);
  const wakeClock = wallClock(last.bedtimeEnd);
  if (bedClock == null || wakeClock == null) return null;

  // Minutes after last night's first bedtime.
  const relative = (ms: number) => (ms - first.startMs) / 60_000;
  const wakeRelative = relative(last.endMs);

  const usualBedtime =
    usual?.bedtimeMinutes != null && Number.isFinite(usual.bedtimeMinutes)
      ? clockDifference(usual.bedtimeMinutes, bedClock)
      : null;
  const usualWake =
    usual?.wakeMinutes != null && Number.isFinite(usual.wakeMinutes)
      ? wakeRelative + clockDifference(usual.wakeMinutes, wakeClock)
      : null;
  const hasUsual =
    usualBedtime != null && usualWake != null && usualWake > usualBedtime;

  const earliest = Math.min(0, hasUsual ? usualBedtime : 0);
  const latest = Math.max(wakeRelative, hasUsual ? usualWake : 0);
  const axisStartClock = Math.floor((bedClock + earliest - 30) / 60) * 60;
  const axisEndClock = Math.ceil((bedClock + latest + 30) / 60) * 60;
  const axisStart = axisStartClock - bedClock;
  const span = axisEndClock - axisStartClock;
  const position = (minutes: number) => minutes - axisStart;

  const segments: NightWindow["segments"] = [];
  const push = (start: number, end: number, stage: NightStage) => {
    const previous = segments.at(-1);
    if (previous && previous.stage === stage && Math.abs(previous.end - start) < 0.01) {
      previous.end = end;
    } else {
      segments.push({ start, end, stage });
    }
  };
  for (const period of ordered) {
    const start = position(relative(period.startMs));
    const end = position(relative(period.endMs));
    const codes = period.hypnogram5min ? Array.from(period.hypnogram5min) : [];
    if (codes.length === 0) {
      push(start, end, "asleep");
      continue;
    }
    codes.forEach((code, index) => {
      const segmentStart = start + index * HYPNOGRAM_STEP_MINUTES;
      if (segmentStart >= end) return;
      push(
        segmentStart,
        Math.min(end, segmentStart + HYPNOGRAM_STEP_MINUTES),
        STAGE_BY_CODE[code] ?? "asleep"
      );
    });
  }

  const step = span <= 12 * 60 ? 120 : 180;
  const ticks: NightWindow["ticks"] = [];
  for (
    let clock = Math.ceil(axisStartClock / step) * step;
    clock <= axisEndClock;
    clock += step
  ) {
    ticks.push({
      at: clock - axisStartClock,
      label: formatClockMinutes(clock, "short"),
    });
  }

  return {
    span,
    segments,
    bedtime: position(0),
    wake: position(wakeRelative),
    usual: hasUsual
      ? { bedtime: position(usualBedtime), wake: position(usualWake) }
      : null,
    ticks,
    bedtimeLabel: formatClockMinutes(bedClock),
    wakeLabel: formatClockMinutes(wakeClock),
  };
}
