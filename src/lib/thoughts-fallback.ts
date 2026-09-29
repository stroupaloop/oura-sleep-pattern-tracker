import { getIsoTimeZoneClockMinutes, shiftIsoDay } from "@/lib/date-utils";
import {
  etWallClockToUnix,
  hashSeed,
  mulberry32,
  unixToEtDay,
} from "@/lib/thoughts-schedule";

export interface FallbackOptions {
  /** Secret mixed into the seed so the timing is not guessable. */
  seed: string;
  minGapHours: number;
  maxGapHours: number;
  /** Waking window in ET, [startHour, endHour). */
  startHour: number;
  endHour: number;
  /** A ping pushed out of the night lands this many minutes into the morning, at most. */
  morningSpreadMinutes: number;
  /** How far behind the clock a ping may still be stamped at its due time. */
  maxBackdateSeconds: number;
}

export const DEFAULT_FALLBACK_OPTIONS: Omit<FallbackOptions, "seed"> = {
  minGapHours: 6,
  maxGapHours: 12,
  startHour: 8,
  endHour: 22,
  morningSpreadMinutes: 90,
  maxBackdateSeconds: 15 * 60,
};

function etClockMinutes(unixSeconds: number): number | null {
  return getIsoTimeZoneClockMinutes(new Date(unixSeconds * 1000).toISOString());
}

export function isWakingTime(
  unixSeconds: number,
  options: Pick<FallbackOptions, "startHour" | "endHour">
): boolean {
  const minutes = etClockMinutes(unixSeconds);
  if (minutes === null) return false;
  return minutes >= options.startHour * 60 && minutes < options.endHour * 60;
}

/**
 * When the automatic ping falls due after `lastActivity`: a random 6-12 hours
 * later, moved to the next morning if that lands at night. Deterministic for
 * a given activity time, so every cron tick agrees on it until something new
 * is logged.
 */
export function fallbackDueAt(
  lastActivity: number,
  options: FallbackOptions
): number | null {
  const rng = mulberry32(hashSeed(`fallback:${lastActivity}:${options.seed}`));
  const span = options.maxGapHours - options.minGapHours;
  const gapSeconds = Math.round((options.minGapHours + rng() * span) * 3600);
  const candidate = lastActivity + gapSeconds;
  if (isWakingTime(candidate, options)) return candidate;

  const minutes = etClockMinutes(candidate);
  if (minutes === null) return null;
  const day = unixToEtDay(candidate);
  const morning =
    minutes < options.startHour * 60 ? day : shiftIsoDay(day, 1);
  if (!morning) return null;
  const spread = Math.floor(rng() * options.morningSpreadMinutes);
  return etWallClockToUnix(morning, options.startHour * 60 + spread);
}

export interface FallbackPing {
  createdAt: number;
  /** Dedupe key: one automatic ping per quiet stretch, however many ticks see it. */
  slot: string;
}

/** The ping to log now, or null when none is due. */
export function fallbackPingDue(
  lastActivity: number | null,
  now: number,
  options: FallbackOptions
): FallbackPing | null {
  if (lastActivity === null) return null;
  const dueAt = fallbackDueAt(lastActivity, options);
  if (dueAt === null || dueAt > now) return null;
  // A tick shortly after the due time keeps its random minute; a long-missed
  // one is stamped now rather than inventing an entry in the past.
  const createdAt = now - dueAt <= options.maxBackdateSeconds ? dueAt : now;
  if (!isWakingTime(createdAt, options)) return null;
  return { createdAt, slot: `fallback:${lastActivity}` };
}
