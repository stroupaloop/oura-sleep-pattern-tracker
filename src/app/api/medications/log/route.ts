import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { medicationLogs } from "@/lib/db/schema";
import { gte, lte, and, eq, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";

const VALID_SLOTS = ["morning", "afternoon", "evening", "night"] as const;
type Slot = (typeof VALID_SLOTS)[number];

function isValidSlot(s: unknown): s is Slot {
  return typeof s === "string" && (VALID_SLOTS as readonly string[]).includes(s);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { medicationId, day, taken, slot } = body;

    if (!medicationId || !day || taken === undefined) {
      return NextResponse.json(
        { error: "medicationId, day, and taken are required" },
        { status: 400 }
      );
    }

    let normalizedSlot: Slot | null;
    if (slot === null || slot === undefined) {
      normalizedSlot = null;
    } else if (isValidSlot(slot)) {
      normalizedSlot = slot;
    } else {
      return NextResponse.json(
        { error: `slot must be one of: ${VALID_SLOTS.join(", ")} or null` },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const takenInt = taken ? 1 : 0;

    if (normalizedSlot === null) {
      // As-needed entries can't use ON CONFLICT (no unique constraint covers NULL slot).
      // Update existing same-day null-slot row if present, otherwise insert.
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
          slot: normalizedSlot,
          taken: takenInt,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [medicationLogs.medicationId, medicationLogs.day, medicationLogs.slot],
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
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");

    const conditions = [];
    if (startDate) conditions.push(gte(medicationLogs.day, startDate));
    if (endDate) conditions.push(lte(medicationLogs.day, endDate));

    const rows = await db
      .select()
      .from(medicationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(medicationLogs.day);

    if (rows.length === 0) {
      return NextResponse.json({ adherence: null, logs: [] });
    }

    const total = rows.length;
    const taken = rows.filter((r) => r.taken === 1).length;
    const adherence = total > 0 ? taken / total : null;

    return NextResponse.json({ adherence, logs: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
