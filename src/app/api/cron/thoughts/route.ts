import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { thoughts } from "@/lib/db/schema";
import { getTodayET, shiftIsoDay } from "@/lib/date-utils";
import {
  DEFAULT_SCHEDULE_OPTIONS,
  duePlannedThoughts,
  expandDayRange,
  planThoughtsForDay,
  type SchedulePlanOptions,
} from "@/lib/thoughts-schedule";

function numberFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) ? raw : fallback;
}

function scheduleOptions(): SchedulePlanOptions | null {
  const seed = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!seed) return null;
  return {
    seed,
    min: numberFromEnv("THOUGHTS_AUTO_MIN", DEFAULT_SCHEDULE_OPTIONS.min),
    max: numberFromEnv("THOUGHTS_AUTO_MAX", DEFAULT_SCHEDULE_OPTIONS.max),
    startHour: numberFromEnv(
      "THOUGHTS_AUTO_START_HOUR",
      DEFAULT_SCHEDULE_OPTIONS.startHour
    ),
    endHour: numberFromEnv(
      "THOUGHTS_AUTO_END_HOUR",
      DEFAULT_SCHEDULE_OPTIONS.endHour
    ),
    minGapMinutes: numberFromEnv(
      "THOUGHTS_AUTO_MIN_GAP_MIN",
      DEFAULT_SCHEDULE_OPTIONS.minGapMinutes
    ),
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.THOUGHTS_AUTO_ENABLED === "0") {
    return NextResponse.json({ status: "disabled", inserted: 0 });
  }

  const options = scheduleOptions();
  if (!options) {
    return NextResponse.json(
      { error: "Missing AUTH_SECRET for schedule seed" },
      { status: 500 }
    );
  }

  try {
    const today = getTodayET();
    const yesterday = shiftIsoDay(today, -1);
    const now = Math.floor(Date.now() / 1000);

    // Yesterday's plan can still have entries pending: the 7am-1am window runs
    // past midnight, and a missed tick should be caught up rather than lost.
    let planDays = yesterday ? [yesterday, today] : [today];

    // ?from=YYYY-MM-DD backfills every day from that date to today. The plan
    // is deterministic, so a backfill produces exactly the rows the scheduled
    // runs would have produced, and re-running it inserts nothing new.
    const from = request.nextUrl.searchParams.get("from");
    if (from) {
      const days = expandDayRange(from, today);
      if (!days) {
        return NextResponse.json(
          { error: "from must be a YYYY-MM-DD date within the last year" },
          { status: 400 }
        );
      }
      planDays = days;
    }
    const due = planDays.flatMap((day) =>
      duePlannedThoughts(planThoughtsForDay(day, options), now)
    );

    let inserted = 0;
    for (const entry of due) {
      const result = await db
        .insert(thoughts)
        .values({
          day: entry.day,
          kind: "thought",
          source: "auto",
          slot: entry.slot,
          note: null,
          link: null,
          createdAt: entry.createdAt,
        })
        // Untargeted: the unique index on `slot` is partial, and SQLite wants
        // the index predicate before DO NOTHING, which the query builder
        // cannot emit. A bare DO NOTHING covers it, and `id` is autoincrement
        // so no other conflict is reachable.
        .onConflictDoNothing();
      inserted += result.rowsAffected ?? 0;
    }

    return NextResponse.json({
      status: "ok",
      due: due.length,
      inserted,
    });
  } catch (error) {
    console.error("Failed to generate thoughts:", error);
    return NextResponse.json(
      { error: "Failed to generate thoughts" },
      { status: 500 }
    );
  }
}
