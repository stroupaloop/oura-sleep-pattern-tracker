import { APP_TIME_ZONE, getIsoTimeZoneClockMinutes } from "@/lib/date-utils";

/** Period types that can make up a night; `rest`, `late_nap` and `deleted` cannot. */
export const NIGHT_SLEEP_TYPES = ["long_sleep", "sleep"] as const;

/**
 * A `sleep` period (Oura's type for confirmed sleep under three hours) needs
 * at least this much sleep to count toward a night, so a doze on the couch
 * does not drag the night's bedtime hours earlier.
 */
export const MIN_SHORT_NIGHT_SECONDS = 60 * 60;

const NIGHT_STARTS_MINUTES = 20 * 60;
const NIGHT_ENDS_MINUTES = 10 * 60;

export interface NightSleepPeriod {
  day: string;
  type: string;
  bedtimeStart: string;
  bedtimeEnd: string;
  totalSleepDuration: number | null;
  deepSleepDuration?: number | null;
  lightSleepDuration?: number | null;
  remSleepDuration?: number | null;
  awakeTime?: number | null;
  timeInBed?: number | null;
  latency?: number | null;
  efficiency?: number | null;
}

/** Whether the period's midpoint falls between 8pm and 10am in `timeZone`. */
export function isOvernightPeriod(
  period: Pick<NightSleepPeriod, "bedtimeStart" | "bedtimeEnd">,
  timeZone = APP_TIME_ZONE
): boolean {
  const start = Date.parse(period.bedtimeStart);
  const end = Date.parse(period.bedtimeEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return false;
  }
  const midpoint = getIsoTimeZoneClockMinutes(
    new Date((start + end) / 2).toISOString(),
    timeZone
  );
  return (
    midpoint != null &&
    (midpoint >= NIGHT_STARTS_MINUTES || midpoint < NIGHT_ENDS_MINUTES)
  );
}

function sleepSeconds(period: NightSleepPeriod): number {
  return period.totalSleepDuration ?? 0;
}

function sumPresent(values: Array<number | null | undefined>): number | null {
  const present = values.filter(
    (value): value is number => value != null && Number.isFinite(value)
  );
  return present.length > 0
    ? present.reduce((total, value) => total + value, 0)
    : null;
}

function longest<T extends NightSleepPeriod>(periods: readonly T[]): T {
  return periods.reduce((best, period) => {
    const difference = sleepSeconds(period) - sleepSeconds(best);
    if (difference !== 0) return difference > 0 ? period : best;
    return Date.parse(period.bedtimeEnd) > Date.parse(best.bedtimeEnd)
      ? period
      : best;
  });
}

/**
 * Joins one night's periods into the longest one: totals and stage times add
 * up, the night runs from the first bedtime to the last wake, and efficiency
 * is recomputed over the combined time in bed. Per-period series (heart
 * rate, hypnogram) and averages stay the longest period's own.
 */
export function combineNightPeriods<T extends NightSleepPeriod>(
  periods: readonly T[]
): T {
  const main = longest(periods);
  if (periods.length === 1) return main;

  const byStart = [...periods].sort(
    (left, right) =>
      Date.parse(left.bedtimeStart) - Date.parse(right.bedtimeStart)
  );
  const first = byStart[0];
  const last = periods.reduce((latest, period) =>
    Date.parse(period.bedtimeEnd) > Date.parse(latest.bedtimeEnd)
      ? period
      : latest
  );
  const totalSleepDuration = sumPresent(
    periods.map((period) => period.totalSleepDuration)
  );
  const timeInBed = sumPresent(periods.map((period) => period.timeInBed));

  return {
    ...main,
    bedtimeStart: first.bedtimeStart,
    bedtimeEnd: last.bedtimeEnd,
    totalSleepDuration,
    deepSleepDuration: sumPresent(
      periods.map((period) => period.deepSleepDuration)
    ),
    lightSleepDuration: sumPresent(
      periods.map((period) => period.lightSleepDuration)
    ),
    remSleepDuration: sumPresent(
      periods.map((period) => period.remSleepDuration)
    ),
    awakeTime: sumPresent(periods.map((period) => period.awakeTime)),
    timeInBed,
    latency: first.latency ?? main.latency ?? null,
    efficiency:
      totalSleepDuration != null && timeInBed != null && timeInBed > 0
        ? Math.round((totalSleepDuration / timeInBed) * 100)
        : main.efficiency ?? null,
  };
}

/**
 * The night for each Oura sleep `day`. Oura types sleep over three hours
 * `long_sleep` and shorter confirmed sleep `sleep`, so a two-hour night, the
 * clearest early sign of activation, arrives as `sleep`, and an afternoon
 * crash can be a `long_sleep` sharing its `day` with the night after it.
 * Overnight periods make the night, combined when sleep was broken. A day
 * without one falls back to its longest `long_sleep`, so a daytime sleeper
 * still has nights, while a lone daytime nap never becomes one.
 */
export function selectNightSleepByDay<T extends NightSleepPeriod>(
  periods: readonly T[],
  timeZone = APP_TIME_ZONE
): Map<string, T> {
  const byDay = new Map<string, { overnight: T[]; daytime: T[] }>();
  for (const period of periods) {
    if (period.type !== "long_sleep" && period.type !== "sleep") continue;
    const overnight = isOvernightPeriod(period, timeZone);
    if (
      period.type === "sleep" &&
      (!overnight || sleepSeconds(period) < MIN_SHORT_NIGHT_SECONDS)
    ) {
      continue;
    }
    const groups = byDay.get(period.day) ?? { overnight: [], daytime: [] };
    (overnight ? groups.overnight : groups.daytime).push(period);
    byDay.set(period.day, groups);
  }

  const nights = new Map<string, T>();
  for (const [day, groups] of byDay) {
    nights.set(
      day,
      groups.overnight.length > 0
        ? combineNightPeriods(groups.overnight)
        : longest(groups.daytime)
    );
  }
  return nights;
}
