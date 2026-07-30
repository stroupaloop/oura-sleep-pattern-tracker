export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { dailyMood, medications, medicationLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MoodForm } from "./mood-form";
import { getTodayET } from "@/lib/date-utils";

export default async function CheckinPage() {
  const today = getTodayET();

  const [existingMood, trackedMeds, todayMedLogs] = await Promise.all([
    db
      .select()
      .from(dailyMood)
      .where(eq(dailyMood.day, today))
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
      .from(medications)
      .orderBy(medications.name),
    db
      .select({
        medicationId: medicationLogs.medicationId,
        slot: medicationLogs.slot,
        taken: medicationLogs.taken,
      })
      .from(medicationLogs)
      .where(eq(medicationLogs.day, today)),
  ]);

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Daily Check-in</h1>
      </div>
      <MoodForm
        initialDay={today}
        existingMood={existingMood}
        medications={trackedMeds}
        existingMedLogs={todayMedLogs}
      />
    </div>
  );
}
