import { desc, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { thoughts } from "@/lib/db/schema";
import { getNowUnixSeconds, getTodayET, shiftIsoDay } from "@/lib/date-utils";
import { loadLinkClickCounts } from "@/lib/link-clicks";
import {
  buildGrid,
  countSince,
  currentStreak,
  formatCompactAgo,
  gridWeekCount,
  noteSizeBucket,
  type GridModel,
} from "@/lib/thoughts-stats";
import type { NotePreview } from "@/components/thoughts/sign-in-tease";
import type { TimelineEntry } from "@/components/thoughts/thought-timeline";

const PREVIEW_LIMIT = 3;

export interface ThoughtOverview {
  total: number;
  thisWeek: number;
  streak: number;
  lastThought: string | null;
  grid: GridModel;
  noteCount: number;
  /** Earliest day the grid covers; also bounds the timeline query. */
  windowStart: string;
}

/**
 * Counts, streak and grid. Shared by the public page and the signed-in one so
 * the two never drift apart.
 */
export async function loadThoughtOverview(): Promise<ThoughtOverview> {
  const today = getTodayET();
  const now = getNowUnixSeconds();

  const [perDay, firstRow, lastRow, noteCount] = await Promise.all([
    db
      .select({ day: thoughts.day, count: sql<number>`count(*)` })
      .from(thoughts)
      .groupBy(thoughts.day),
    db
      .select({ day: thoughts.day })
      .from(thoughts)
      .orderBy(thoughts.day)
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ createdAt: thoughts.createdAt })
      .from(thoughts)
      .orderBy(desc(thoughts.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ count: sql<number>`count(*)` })
      .from(thoughts)
      .where(or(isNotNull(thoughts.note), isNotNull(thoughts.link)))
      .then((rows) => Number(rows[0]?.count ?? 0)),
  ]);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of perDay) {
    const value = Number(row.count ?? 0);
    counts[row.day] = value;
    total += value;
  }

  const firstDay = firstRow?.day ?? null;
  const weeks = gridWeekCount(firstDay, today);

  return {
    total,
    thisWeek: countSince(counts, today, 7),
    streak: currentStreak(counts, today),
    lastThought: formatCompactAgo(lastRow?.createdAt ?? null, now),
    grid: buildGrid(counts, today, firstDay),
    noteCount,
    windowStart: shiftIsoDay(today, -(weeks * 7)) ?? today,
  };
}

/**
 * Shape only — when a note was written, whether it carries a link, and a
 * coarse length. The note text is deliberately never selected here, so the
 * public page cannot leak it.
 */
export async function loadNotePreviews(): Promise<NotePreview[]> {
  return db
    .select({
      id: thoughts.id,
      createdAt: thoughts.createdAt,
      hasLink: sql<number>`(${thoughts.link} is not null)`,
      noteLength: sql<number>`length(coalesce(${thoughts.note}, ''))`,
    })
    .from(thoughts)
    .where(or(isNotNull(thoughts.note), isNotNull(thoughts.link)))
    .orderBy(desc(thoughts.createdAt))
    .limit(PREVIEW_LIMIT)
    .then((rows) =>
      rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        hasLink: Number(row.hasLink) === 1,
        size: noteSizeBucket(Number(row.noteLength)),
      }))
    );
}

/**
 * Every entry, newest first: written notes and the bare "thought of you" pings
 * alike, so the feed shows each time she crossed your mind and exactly when.
 * Only ever called from an authenticated render. Paginated over the whole log
 * rather than the grid window, so older entries stay reachable as it grows.
 */
export async function loadTimeline(
  limit: number,
  offset: number
): Promise<TimelineEntry[]> {
  const entries = await db
    .select({
      id: thoughts.id,
      note: thoughts.note,
      link: thoughts.link,
      createdAt: thoughts.createdAt,
    })
    .from(thoughts)
    .orderBy(desc(thoughts.createdAt))
    .limit(limit)
    .offset(offset);

  const clicks = await loadLinkClickCounts(
    entries.filter((entry) => entry.link).map((entry) => entry.id)
  );
  return entries.map((entry) => ({
    ...entry,
    linkClicks: clicks ? (clicks.get(entry.id) ?? 0) : undefined,
  }));
}
