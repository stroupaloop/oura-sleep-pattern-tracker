import { APP_TIME_ZONE, shiftIsoDay } from "@/lib/date-utils";

export interface SchedulePlanOptions {
  /** Secret mixed into the seed so the schedule is not guessable. */
  seed: string;
  min: number;
  max: number;
  /** Window start, in hours from ET midnight. */
  startHour: number;
  /** Window end, exclusive. May exceed 24 to cross midnight (25 = 1am). */
  endHour: number;
  minGapMinutes: number;
  /**
   * Bias of the daily count toward the low end. 1 is uniform; higher values
   * make most days ordinary and leave a thin tail of heavy days, so the grid
   * uses the whole colour ramp instead of two steps.
   */
  skew: number;
}

export const DEFAULT_SCHEDULE_OPTIONS: Omit<SchedulePlanOptions, "seed"> = {
  min: 1,
  max: 8,
  startHour: 7,
  endHour: 25,
  minGapMinutes: 35,
  skew: 2.2,
};

export interface PlannedThought {
  /** Globally unique dedupe key, e.g. "2026-09-25#1". */
  slot: string;
  /** ET calendar day the entry lands on (may be the next day near midnight). */
  day: string;
  createdAt: number;
}

function hashSeed(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function zoneOffsetMs(timestampMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(timestampMs));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - timestampMs;
}

/**
 * Unix seconds for a wall-clock time in the app time zone. `minutes` is an
 * offset from midnight and may exceed 1440 to reach the following day.
 */
export function etWallClockToUnix(
  day: string,
  minutes: number,
  timeZone = APP_TIME_ZONE
): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(minutes)) {
    return null;
  }
  const dayShift = Math.floor(minutes / 1440);
  const within = minutes - dayShift * 1440;
  const targetDay = dayShift === 0 ? day : shiftIsoDay(day, dayShift);
  if (!targetDay) return null;

  const hours = Math.floor(within / 60);
  const mins = Math.floor(within % 60);
  const naive = Date.parse(
    `${targetDay}T${pad(hours)}:${pad(mins)}:00Z`
  );
  if (!Number.isFinite(naive)) return null;

  // Correct for the zone offset, then re-check in case the first guess landed
  // on the other side of a DST transition.
  const firstOffset = zoneOffsetMs(naive, timeZone);
  let resolved = naive - firstOffset;
  const secondOffset = zoneOffsetMs(resolved, timeZone);
  if (secondOffset !== firstOffset) {
    resolved = naive - secondOffset;
  }
  return Math.floor(resolved / 1000);
}

export function unixToEtDay(
  unixSeconds: number,
  timeZone = APP_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(
    new Date(unixSeconds * 1000)
  );
}

/**
 * The day's auto-entry schedule. Deterministic for a given (day, seed), so
 * every cron tick recomputes the same plan and inserts are idempotent.
 */
export function planThoughtsForDay(
  day: string,
  options: SchedulePlanOptions
): PlannedThought[] {
  const { seed, min, max, startHour, endHour, minGapMinutes } = options;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];

  const lo = Math.max(0, Math.min(min, max));
  const hi = Math.max(lo, Math.max(min, max));
  const windowStart = Math.round(startHour * 60);
  const windowEnd = Math.round(endHour * 60);
  if (windowEnd <= windowStart) return [];

  const rng = mulberry32(hashSeed(`${day}:${seed}`));
  // Raising a uniform sample to a power > 1 pushes it toward zero, so most
  // days land near `lo` and only occasionally reach `hi`.
  const skew = Number.isFinite(options.skew) && options.skew > 0 ? options.skew : 1;
  const count = lo + Math.floor(Math.pow(rng(), skew) * (hi - lo + 1));
  if (count <= 0) return [];

  const span = windowEnd - windowStart;
  const chosen: number[] = [];
  const maxAttempts = count * 60;
  for (let attempt = 0; attempt < maxAttempts && chosen.length < count; attempt++) {
    const candidate = windowStart + Math.floor(rng() * span);
    const clashes = chosen.some(
      (existing) => Math.abs(existing - candidate) < minGapMinutes
    );
    if (!clashes) chosen.push(candidate);
  }
  chosen.sort((a, b) => a - b);

  const planned: PlannedThought[] = [];
  chosen.forEach((minutes, index) => {
    const createdAt = etWallClockToUnix(day, minutes);
    if (createdAt === null) return;
    planned.push({
      slot: `${day}#${index}`,
      day: unixToEtDay(createdAt),
      createdAt,
    });
  });
  return planned;
}

/** Planned entries whose time has already passed. */
export function duePlannedThoughts(
  planned: PlannedThought[],
  nowUnixSeconds: number
): PlannedThought[] {
  return planned.filter((entry) => entry.createdAt <= nowUnixSeconds);
}

export const MAX_BACKFILL_DAYS = 366;

/**
 * Inclusive list of ET days from `from` to `to`, or null when the input is
 * malformed, inverted, or spans more than a year.
 */
export function expandDayRange(from: string, to: string): string[] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return null;
  }
  const span = Math.floor((end - start) / 86_400_000) + 1;
  if (span > MAX_BACKFILL_DAYS) return null;

  const days: string[] = [];
  let cursor = from;
  for (let i = 0; i < span; i++) {
    days.push(cursor);
    const next = shiftIsoDay(cursor, 1);
    if (!next) break;
    cursor = next;
  }
  return days;
}
