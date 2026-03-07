import { NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sleepPeriods, cyclePredictions } from "@/lib/db/schema";
import { eq, gte, and, isNotNull, count, max } from "drizzle-orm";
import { format, subDays } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isSensitiveUser(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = format(subDays(new Date(), 365), "yyyy-MM-dd");

  const [totalSleep, withTemp, cycleRows, lastSync] = await Promise.all([
    db
      .select({ count: count() })
      .from(sleepPeriods)
      .where(and(gte(sleepPeriods.day, cutoff), eq(sleepPeriods.type, "long_sleep"))),
    db
      .select({ count: count() })
      .from(sleepPeriods)
      .where(
        and(
          gte(sleepPeriods.day, cutoff),
          eq(sleepPeriods.type, "long_sleep"),
          isNotNull(sleepPeriods.temperatureDelta)
        )
      ),
    db.select({ count: count() }).from(cyclePredictions),
    db
      .select({ latest: max(cyclePredictions.createdAt) })
      .from(cyclePredictions),
  ]);

  return NextResponse.json({
    sleepPeriodsLast365: totalSleep[0]?.count ?? 0,
    withTemperatureDelta: withTemp[0]?.count ?? 0,
    cyclePredictionRows: cycleRows[0]?.count ?? 0,
    lastCyclePredictionAt: lastSync[0]?.latest
      ? new Date(lastSync[0].latest * 1000).toISOString()
      : null,
  });
}
