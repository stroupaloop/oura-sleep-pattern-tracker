export const dynamic = "force-dynamic";

import Link from "next/link";
import { and, desc, gte, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { thoughts } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { isAuthorEmail } from "@/lib/access";
import { getNowUnixSeconds, getTodayET, shiftIsoDay } from "@/lib/date-utils";
import {
  buildGrid,
  countSince,
  currentStreak,
  formatCompactAgo,
  gridWeekCount,
} from "@/lib/thoughts-stats";
import { Button } from "@/components/ui/button";
import { StatTiles } from "@/components/thoughts/stat-tiles";
import { ThoughtGrid } from "@/components/thoughts/thought-grid";
import { ThoughtComposer } from "@/components/thoughts/thought-composer";
import {
  ThoughtTimeline,
  type TimelineEntry,
} from "@/components/thoughts/thought-timeline";
import { VisitBeacon } from "@/components/thoughts/visit-beacon";

const TIMELINE_LIMIT = 25;

export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  const isAuthor = isAuthorEmail(session?.user?.email);

  const today = getTodayET();
  const now = getNowUnixSeconds();

  const [totals, firstRow, lastRow, noteCountRow] = await Promise.all([
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
  for (const row of totals) {
    const value = Number(row.count ?? 0);
    counts[row.day] = value;
    total += value;
  }

  const firstDay = firstRow?.day ?? null;
  const grid = buildGrid(counts, today, firstDay);
  const weeks = gridWeekCount(firstDay, today);
  const windowStart = shiftIsoDay(today, -(weeks * 7)) ?? today;

  // Notes are the gated payload: never queried for a signed-out render, so
  // they are not in the HTML at all.
  const timeline: TimelineEntry[] = signedIn
    ? await db
        .select({
          id: thoughts.id,
          note: thoughts.note,
          link: thoughts.link,
          createdAt: thoughts.createdAt,
        })
        .from(thoughts)
        .where(
          and(
            or(isNotNull(thoughts.note), isNotNull(thoughts.link)),
            gte(thoughts.day, windowStart)
          )
        )
        .orderBy(desc(thoughts.createdAt))
        .limit(TIMELINE_LIMIT)
    : [];

  return (
    <div className="min-h-screen px-4 py-10 md:py-16">
      <VisitBeacon path="/" />

      <main className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <span className="text-5xl">🦥</span>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Thinking of you
          </h1>
          <p className="text-sm text-muted-foreground">
            Every time you crossed my mind, and when.
          </p>
        </header>

        <StatTiles
          total={total}
          thisWeek={countSince(counts, today, 7)}
          streak={currentStreak(counts, today)}
          lastThought={formatCompactAgo(lastRow?.createdAt ?? null, now)}
        />

        <ThoughtGrid grid={grid} total={total} />

        {isAuthor && <ThoughtComposer />}

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {signedIn ? "The notes" : "There's more here"}
          </h2>

          {signedIn ? (
            <ThoughtTimeline entries={timeline} />
          ) : (
            <div className="rounded-lg border bg-card px-4 py-5 text-sm">
              <p className="text-muted-foreground">
                {noteCountRow > 0
                  ? `${noteCountRow} ${
                      noteCountRow === 1 ? "note is" : "notes are"
                    } attached to those — what made me think of you, and the links I saved. Sign in to read them.`
                  : "Sign in to see the notes as they get added."}
              </p>
              <Button asChild className="mt-3">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          )}
        </section>

        {signedIn && (
          <div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Go to the dashboard →</Link>
            </Button>
          </div>
        )}
      </main>

      <footer className="mx-auto mt-16 max-w-3xl space-x-4 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
