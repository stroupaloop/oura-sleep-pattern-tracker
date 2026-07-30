import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { medicationLogs, medications } from "@/lib/db/schema";
import { gte, lte, and, eq, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import {
  parseMedicationLogRange,
  parseMedicationLogWrite,
} from "@/lib/medication-log";
import { slotsForMedication } from "@/lib/medication-schedule";
import { getTodayET } from "@/lib/date-utils";

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();

  try {
    const parsed = parseMedicationLogWrite(await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { medicationId, day, taken, slot } = parsed;
    if (day > getTodayET()) {
      return NextResponse.json(
        { error: "Future medication logs are not allowed" },
        { status: 400 }
      );
    }

    const [medication] = await db
      .select({
        id: medications.id,
        frequency: medications.frequency,
        doseSchedule: medications.doseSchedule,
        startDate: medications.startDate,
        endDate: medications.endDate,
      })
      .from(medications)
      .where(eq(medications.id, medicationId))
      .limit(1);
    if (!medication) {
      return NextResponse.json(
        { error: "Medication not found" },
        { status: 404 }
      );
    }

    if (
      (medication.startDate && day < medication.startDate) ||
      (medication.endDate && day > medication.endDate)
    ) {
      return NextResponse.json(
        { error: "day is outside this medication's tracking period" },
        { status: 400 }
      );
    }

    const scheduledSlots = slotsForMedication(medication);
    if (medication.frequency === "as_needed") {
      if (slot !== null) {
        return NextResponse.json(
          { error: "As-needed medication logs must use a null slot" },
          { status: 400 }
        );
      }
    } else if (slot === null || !scheduledSlots.includes(slot)) {
      return NextResponse.json(
        { error: "slot does not match this medication's schedule" },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const takenInt = taken ? 1 : 0;

    if (slot === null) {
      const existing = await db
        .select({ id: medicationLogs.id })
        .from(medicationLogs)
        .where(
          and(
            eq(medicationLogs.medicationId, medicationId),
            eq(medicationLogs.day, day),
            isNull(medicationLogs.slot)
          )
        )
        .limit(1);

      if (existing[0]) {
        await db
          .update(medicationLogs)
          .set({ taken: takenInt })
          .where(eq(medicationLogs.id, existing[0].id));
      } else {
        await db.insert(medicationLogs).values({
          medicationId,
          day,
          slot: null,
          taken: takenInt,
          createdAt: now,
        });
      }
    } else {
      await db
        .insert(medicationLogs)
        .values({
          medicationId,
          day,
          slot,
          taken: takenInt,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [medicationLogs.medicationId, medicationLogs.day, medicationLogs.slot],
          targetWhere: sql`${medicationLogs.slot} IS NOT NULL`,
          set: {
            taken: sql`excluded.taken`,
          },
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const parsed = parseMedicationLogRange(
      searchParams.get("start"),
      searchParams.get("end")
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { start: startDate, end: endDate } = parsed;

    const conditions = [];
    if (startDate) conditions.push(gte(medicationLogs.day, startDate));
    if (endDate) conditions.push(lte(medicationLogs.day, endDate));

    const rows = await db
      .select()
      .from(medicationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(medicationLogs.day);

    return NextResponse.json({ logs: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
