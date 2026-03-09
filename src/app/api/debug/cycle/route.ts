import { NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sleepPeriods, cyclePredictions, dailyReadiness, enhancedTags, restModePeriods, sleepTime } from "@/lib/db/schema";
import { eq, gte, and, isNotNull, count, max, desc } from "drizzle-orm";
import { format, subDays } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isSensitiveUser(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = format(subDays(new Date(), 365), "yyyy-MM-dd");

  const [totalSleep, withTemp, readinessTotal, readinessWithTemp, cycleRows, lastSync, tagCount, restCount, cycleDetails, sleepTimeSample] =
    await Promise.all([
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
      db
        .select({ count: count() })
        .from(dailyReadiness)
        .where(gte(dailyReadiness.day, cutoff)),
      db
        .select({ count: count() })
        .from(dailyReadiness)
        .where(
          and(
            gte(dailyReadiness.day, cutoff),
            isNotNull(dailyReadiness.temperatureDeviation)
          )
        ),
      db.select({ count: count() }).from(cyclePredictions),
      db
        .select({ latest: max(cyclePredictions.createdAt) })
        .from(cyclePredictions),
      db.select({ count: count() }).from(enhancedTags),
      db.select({ count: count() }).from(restModePeriods),
      db.select().from(cyclePredictions).orderBy(cyclePredictions.cycleNumber),
      db.select().from(sleepTime).orderBy(desc(sleepTime.day)).limit(5),
    ]);

  return NextResponse.json({
    sleepPeriodsLast365: totalSleep[0]?.count ?? 0,
    withTemperatureDelta: withTemp[0]?.count ?? 0,
    readinessLast365: readinessTotal[0]?.count ?? 0,
    readinessWithTemperatureDeviation: readinessWithTemp[0]?.count ?? 0,
    cyclePredictionRows: cycleRows[0]?.count ?? 0,
    lastCyclePredictionAt: lastSync[0]?.latest
      ? new Date(lastSync[0].latest * 1000).toISOString()
      : null,
    enhancedTagsCount: tagCount[0]?.count ?? 0,
    restModePeriodsCount: restCount[0]?.count ?? 0,
    cycleDetails,
    sleepTimeSample,
  });
}
