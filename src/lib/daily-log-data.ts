import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyMood, medications, medicationLogs } from "@/lib/db/schema";

/**
 * Everything the daily log needs for one day. Shared by every page that shows
 * it, so the log reads the same wherever it appears.
 */
export async function loadDailyLog(day: string) {
  const [mood, trackedMeds, medLogs] = await Promise.all([
    db
      .select({
        moodScore: dailyMood.moodScore,
        episodeState: dailyMood.episodeState,
        tags: dailyMood.tags,
        notes: dailyMood.notes,
      })
      .from(dailyMood)
      .where(eq(dailyMood.day, day))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        id: medications.id,
        name: medications.name,
        dosage: medications.dosage,
        frequency: medications.frequency,
        doseSchedule: medications.doseSchedule,
        startDate: medications.startDate,
        endDate: medications.endDate,
      })
      .from(medications),
    db
      .select({
        medicationId: medicationLogs.medicationId,
        slot: medicationLogs.slot,
        taken: medicationLogs.taken,
      })
      .from(medicationLogs)
      .where(eq(medicationLogs.day, day)),
  ]);
  return { mood, medications: trackedMeds, medLogs };
}
