import { db } from "@/lib/db";
import { dailyMood, medications, sleepPeriods } from "@/lib/db/schema";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";

export interface DataCoverage {
  overall: number;
  oura: { days: number; total: number; rate: number };
  mood: { days: number; total: number; rate: number };
  medications: { tracked: boolean };
  suggestions: string[];
}

export async function computeDataCoverage(
  windowDays = 30
): Promise<DataCoverage> {
  const today = getTodayET();
  const startDate = format(
    subDays(new Date(`${today}T12:00:00`), windowDays - 1),
    "yyyy-MM-dd"
  );

  const [ouraSleepCount, moodCount, medCount] = await Promise.all([
    db
      .select({
        count: sql<number>`count(distinct ${sleepPeriods.day})`,
      })
      .from(sleepPeriods)
      .where(
        and(
          gte(sleepPeriods.day, startDate),
          eq(sleepPeriods.type, "long_sleep"),
          isNotNull(sleepPeriods.totalSleepDuration)
        )
      )
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(dailyMood)
      .where(gte(dailyMood.day, startDate))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(medications)
      .then((r) => r[0]?.count ?? 0),
  ]);

  const ouraRate = windowDays > 0 ? ouraSleepCount / windowDays : 0;
  const moodRate = windowDays > 0 ? moodCount / windowDays : 0;
  const hasMeds = medCount > 0;

  const overall = Math.round(
    Math.min(1, ouraRate) * 70 + Math.min(1, moodRate) * 30
  );

  const suggestions: string[] = [];
  if (moodRate < 0.7) {
    suggestions.push("Add mood entries to give pattern flags symptom context");
  }
  if (!hasMeds) {
    suggestions.push("Record medications so reports include schedule context");
  }
  if (ouraRate < 0.9) {
    suggestions.push("Wear your ring more consistently for better baselines");
  }

  return {
    overall,
    oura: { days: ouraSleepCount, total: windowDays, rate: ouraRate },
    mood: { days: moodCount, total: windowDays, rate: moodRate },
    medications: { tracked: hasMeds },
    suggestions,
  };
}
