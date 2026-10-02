import { NextRequest, NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";
import { loadOuraGrant } from "@/lib/oura/client";
import { measureBackfillCoverage } from "@/lib/oura/backfill-coverage";
import { runOuraSyncPipeline } from "@/lib/oura/sync-pipeline";

// A 90-day backfill plus a full pattern-history recompute takes about a
// minute; heart-rate writes are batched to keep it well inside this.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const cronAuth = request.headers.get("authorization");
  const isCron = process.env.CRON_SECRET && cronAuth === `Bearer ${process.env.CRON_SECRET}`;
  let userEmail: string | null | undefined = null;
  if (!isCron) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSensitiveUser(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    userEmail = session.user.email;
  }

  const body = await request.json().catch(() => ({}));
  const days = Math.min(Number(body.days) || 90, 365);

  const endDate = getTodayET();
  const startDate = format(
    subDays(new Date(`${endDate}T12:00:00`), days - 1),
    "yyyy-MM-dd"
  );
  const includePrivate = Boolean(isCron || isSensitiveUser(userEmail));

  try {
    const result = await runOuraSyncPipeline({
      startDate,
      endDate,
      syncType: "backfill",
      includePrivate,
      // History follows the current algorithm, not just the backfilled days.
      recompute: "history",
    });
    const coverage = await loadOuraGrant()
      .then((granted) =>
        measureBackfillCoverage(startDate, endDate, granted, includePrivate)
      )
      .catch((error) => {
        console.error("Backfill coverage error:", error);
        return null;
      });

    return NextResponse.json({ ...result, coverage });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        startDate,
        endDate,
      },
      { status: 500 }
    );
  }
}
