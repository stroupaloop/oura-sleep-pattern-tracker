import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { thoughts } from "@/lib/db/schema";
import { getNowUnixSeconds } from "@/lib/date-utils";
import { unixToEtDay } from "@/lib/thoughts-schedule";
import {
  DEFAULT_FALLBACK_OPTIONS,
  fallbackClockStart,
  fallbackPingDue,
} from "@/lib/thoughts-fallback";
import { loadFallbackSetting } from "@/lib/thoughts-fallback-setting";

/**
 * Logs a "thought of you" when nothing has been logged for a random 6-12
 * hours, within waking hours. Any entry resets the clock: a ping, a note, a
 * link, an edit, or one of these automatic pings. Admins switch it off and on
 * in Settings; THOUGHTS_FALLBACK_ENABLED=0 still overrides that.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.THOUGHTS_FALLBACK_ENABLED === "0") {
    return NextResponse.json({ status: "disabled", inserted: 0 });
  }

  const seed = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!seed) {
    return NextResponse.json(
      { error: "Missing AUTH_SECRET for fallback seed" },
      { status: 500 }
    );
  }

  try {
    const setting = await loadFallbackSetting();
    if (!setting.enabled) {
      return NextResponse.json({ status: "disabled", inserted: 0 });
    }

    const lastActivity = await db
      .select({
        at: sql<number | null>`max(max(${thoughts.createdAt}, coalesce(${thoughts.updatedAt}, 0)))`,
      })
      .from(thoughts)
      .then((rows) => {
        const at = rows[0]?.at;
        return at == null ? null : Number(at);
      });

    const now = getNowUnixSeconds();
    const ping = fallbackPingDue(
      fallbackClockStart(lastActivity, setting.updatedAt),
      now,
      {
        ...DEFAULT_FALLBACK_OPTIONS,
        seed,
      }
    );
    if (!ping) {
      return NextResponse.json({ status: "not-due", lastActivity, inserted: 0 });
    }

    const result = await db
      .insert(thoughts)
      .values({
        day: unixToEtDay(ping.createdAt),
        kind: "thought",
        source: "auto",
        slot: ping.slot,
        note: null,
        link: null,
        createdAt: ping.createdAt,
      })
      // Same partial unique index on `slot` as the scheduled route, so a
      // second tick for the same quiet stretch inserts nothing.
      .onConflictDoNothing();

    return NextResponse.json({
      status: "ok",
      lastActivity,
      createdAt: ping.createdAt,
      inserted: result.rowsAffected ?? 0,
    });
  } catch (error) {
    console.error("Failed to log fallback thought:", error);
    return NextResponse.json(
      { error: "Failed to log fallback thought" },
      { status: 500 }
    );
  }
}
