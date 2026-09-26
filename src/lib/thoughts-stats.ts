import { shiftIsoDay } from "@/lib/date-utils";

export const MIN_GRID_WEEKS = 12;
export const MAX_GRID_WEEKS = 53;

/**
 * Upper bound of each bucket; a day with more than the last bound uses the
 * top step. Index into the sequential colour ramp is the bucket number.
 */
export const BUCKET_BOUNDS = [0, 1, 3, 6] as const;

export type Bucket = 0 | 1 | 2 | 3 | 4;

export function bucketForCount(count: number): Bucket {
  if (!Number.isFinite(count) || count <= 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

function dayOfWeek(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export interface GridCell {
  day: string;
  count: number;
  bucket: Bucket;
  /** Days after `today` that pad out the final week. */
  future: boolean;
}

export interface GridWeek {
  /** Sunday-first, always 7 entries; null pads the first week. */
  days: (GridCell | null)[];
}

export interface GridModel {
  weeks: GridWeek[];
  startDay: string;
  endDay: string;
}

/**
 * Number of whole weeks the grid should span: enough to cover history since
 * `firstDay`, clamped so a young dataset never renders as a near-empty year.
 */
export function gridWeekCount(
  firstDay: string | null,
  today: string
): number {
  if (!firstDay) return MIN_GRID_WEEKS;
  const start = Date.parse(`${firstDay}T12:00:00Z`);
  const end = Date.parse(`${today}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return MIN_GRID_WEEKS;
  }
  const days = Math.floor((end - start) / 86_400_000) + 1;
  const weeks = Math.ceil(days / 7) + 1;
  return Math.min(MAX_GRID_WEEKS, Math.max(MIN_GRID_WEEKS, weeks));
}

export function buildGrid(
  counts: Record<string, number>,
  today: string,
  firstDay: string | null
): GridModel {
  const weeks = gridWeekCount(firstDay, today);

  // End on the Saturday of the current week so the last column is complete.
  const endDay = shiftIsoDay(today, 6 - dayOfWeek(today)) ?? today;
  const startDay = shiftIsoDay(endDay, -(weeks * 7 - 1)) ?? today;

  const out: GridWeek[] = [];
  let cursor = startDay;
  for (let w = 0; w < weeks; w++) {
    const days: (GridCell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const count = counts[cursor] ?? 0;
      days.push({
        day: cursor,
        count,
        bucket: bucketForCount(count),
        future: cursor > today,
      });
      cursor = shiftIsoDay(cursor, 1) ?? cursor;
    }
    out.push({ days });
  }

  return { weeks: out, startDay, endDay };
}

/**
 * Consecutive days with at least one thought, counting back from today.
 * A day with nothing logged yet does not break the streak until it is over,
 * so an empty morning does not read as a reset.
 */
export function currentStreak(
  counts: Record<string, number>,
  today: string
): number {
  let cursor = today;
  if (!(counts[cursor] > 0)) {
    const yesterday = shiftIsoDay(today, -1);
    if (!yesterday || !(counts[yesterday] > 0)) return 0;
    cursor = yesterday;
  }

  let streak = 0;
  while (counts[cursor] > 0) {
    streak++;
    const prev = shiftIsoDay(cursor, -1);
    if (!prev) break;
    cursor = prev;
  }
  return streak;
}

export function countSince(
  counts: Record<string, number>,
  today: string,
  days: number
): number {
  let total = 0;
  for (let i = 0; i < days; i++) {
    const day = shiftIsoDay(today, -i);
    if (!day) break;
    total += counts[day] ?? 0;
  }
  return total;
}

/** Compact relative time for a stat tile: "just now", "2h ago", "3d ago". */
export function formatCompactAgo(
  unixSeconds: number | null,
  nowUnixSeconds: number
): string | null {
  if (unixSeconds === null || !Number.isFinite(unixSeconds)) return null;
  const delta = Math.max(0, nowUnixSeconds - unixSeconds);
  if (delta < 90) return "just now";
  const minutes = Math.round(delta / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(delta / 3600);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(delta / 86400);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}
