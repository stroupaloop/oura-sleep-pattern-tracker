export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { dailyMood, medications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { MoodForm } from "./mood-form";

export default async function CheckinPage() {
  const today = format(new Date(), "yyyy-MM-dd");

  const [existingMood, activeMeds] = await Promise.all([
    db
      .select()
      .from(dailyMood)
      .where(eq(dailyMood.day, today))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ id: medications.id, name: medications.name, dosage: medications.dosage })
      .from(medications)
      .where(eq(medications.isActive, 1))
      .orderBy(medications.name),
  ]);

  return (
    <div className="max-w-lg mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Daily Check-in</h1>
        <p className="text-muted-foreground text-sm mt-1">{today}</p>
      </div>
      <MoodForm today={today} existingMood={existingMood} medications={activeMeds} />
    </div>
  );
}
