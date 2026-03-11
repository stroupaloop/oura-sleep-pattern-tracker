export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { dailyMood, medications } from "@/lib/db/schema";
import { eq, and, or, lte, isNull } from "drizzle-orm";
import { MoodForm } from "./mood-form";
import { getTodayET } from "@/lib/date-utils";

export default async function CheckinPage() {
  const today = getTodayET();

  const [existingMood, activeMeds] = await Promise.all([
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
        startDate: medications.startDate,
        endDate: medications.endDate,
      })
      .from(medications)
      .where(
        and(
          eq(medications.isActive, 1),
          or(lte(medications.startDate, today), isNull(medications.startDate)),
          or(isNull(medications.endDate))
        )
      )
      .orderBy(medications.name),
  ]);

  return (
    <div className="max-w-lg mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Daily Check-in</h1>
      </div>
      <MoodForm
        initialDay={today}
        existingMood={existingMood}
        medications={activeMeds}
      />
    </div>
  );
}
