import { db } from "@/lib/db";
import { dailyAnalysis, dailyMood, medications, medicationLogs } from "@/lib/db/schema";
import { gte, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { format, subDays } from "date-fns";

export interface DataConfidence {
  overall: number;
  oura: { days: number; total: number; rate: number };
  mood: { days: number; total: number; rate: number };
  medications: { tracked: boolean };
  suggestions: string[];
}

export async function computeDataConfidence(windowDays = 30): Promise<DataConfidence> {
  const startDate = format(subDays(new Date(), windowDays), "yyyy-MM-dd");

  const [analysisCount, moodCount, medCount] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(dailyAnalysis)
      .where(gte(dailyAnalysis.day, startDate))
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

  const ouraRate = windowDays > 0 ? analysisCount / windowDays : 0;
  const moodRate = windowDays > 0 ? moodCount / windowDays : 0;
  const hasMeds = medCount > 0;

  let overall = 60;
  if (moodRate > 0.7) overall += 20;
  else if (moodRate > 0.3) overall += 10;
  if (hasMeds) overall += 10;
  if (ouraRate > 0.9) overall += 10;
  else if (ouraRate > 0.7) overall += 5;
  overall = Math.min(100, overall);

  const suggestions: string[] = [];
  if (moodRate < 0.7) {
    suggestions.push("Adding daily mood entries improves accuracy by ~20%");
  }
  if (!hasMeds) {
    suggestions.push("Track medications to distinguish medication effects from episode signals");
  }
  if (ouraRate < 0.9) {
    suggestions.push("Wear your ring more consistently for better baselines");
  }

  return {
    overall,
    oura: { days: analysisCount, total: windowDays, rate: ouraRate },
    mood: { days: moodCount, total: windowDays, rate: moodRate },
    medications: { tracked: hasMeds },
    suggestions,
  };
}
