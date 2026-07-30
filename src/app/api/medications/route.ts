import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { medicationLogs, medications } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { getTodayET } from "@/lib/date-utils";
import {
  parseMedicationCreate,
  parseMedicationUpdate,
  planMedicationUpdate,
} from "@/lib/medication-write";

class MedicationMutationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409
  ) {
    super(message);
  }
}

function isMedicationLineageConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("medications.previous_version_id") ||
    message.includes("medications_previous_version_id_uniq") ||
    message.includes("SQLITE_BUSY")
  );
}

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all");

    const rows = all
      ? await db.select().from(medications).orderBy(medications.name)
      : await db
          .select()
          .from(medications)
          .where(eq(medications.isActive, 1))
          .orderBy(medications.name);

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const parsed = parseMedicationCreate(body, getTodayET());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await db
      .insert(medications)
      .values({
        ...parsed.value,
        createdAt: now,
      })
      .returning();

    return NextResponse.json(result[0]);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }
    const parsed = parseMedicationUpdate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const today = getTodayET();
    const now = Math.floor(Date.now() / 1000);
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(medications)
        .where(eq(medications.id, parsed.value.id))
        .limit(1);
      if (!existing) {
        throw new MedicationMutationError("Medication not found", 404);
      }

      const [successor] = await tx
        .select({ id: medications.id })
        .from(medications)
        .where(eq(medications.previousVersionId, existing.id))
        .limit(1);
      const plan = planMedicationUpdate(
        existing,
        parsed.value,
        today,
        successor !== undefined
      );
      if (!plan.ok) {
        throw new MedicationMutationError(plan.error, plan.status);
      }

      if (plan.kind === "noop") {
        return {
          row: existing,
          versioned: false,
          cancelledVersion: false,
        };
      }

      if (plan.kind === "cancel-future-version") {
        const [existingLog] = await tx
          .select({ id: medicationLogs.id })
          .from(medicationLogs)
          .where(eq(medicationLogs.medicationId, existing.id))
          .limit(1);
        if (existingLog) {
          throw new MedicationMutationError(
            "A medication version with recorded logs cannot be cancelled",
            409
          );
        }

        const [deleted] = await tx
          .delete(medications)
          .where(
            and(
              eq(medications.id, existing.id),
              eq(medications.isActive, 1),
              gt(medications.startDate, today),
              eq(medications.previousVersionId, plan.predecessorId)
            )
          )
          .returning({ id: medications.id });
        if (!deleted) {
          throw new MedicationMutationError(
            "Medication changed concurrently; refresh and try again",
            409
          );
        }

        const [restored] = await tx
          .update(medications)
          .set({ isActive: 1, endDate: null })
          .where(
            and(
              eq(medications.id, plan.predecessorId),
              eq(medications.isActive, 0)
            )
          )
          .returning();
        if (!restored) {
          throw new MedicationMutationError(
            "The prior medication version could not be restored",
            409
          );
        }
        return {
          row: restored,
          versioned: false,
          cancelledVersion: true,
        };
      }

      if (plan.kind === "update") {
        const condition =
          plan.updates.isActive === 0
            ? and(
                eq(medications.id, existing.id),
                eq(medications.isActive, 1)
              )
            : eq(medications.id, existing.id);
        const [updated] = await tx
          .update(medications)
          .set(plan.updates)
          .where(condition)
          .returning();
        if (!updated) {
          throw new MedicationMutationError(
            "Medication changed concurrently; refresh and try again",
            409
          );
        }
        return {
          row: updated,
          versioned: false,
          cancelledVersion: false,
        };
      }

      if (plan.closeUpdates) {
        const [closed] = await tx
          .update(medications)
          .set(plan.closeUpdates)
          .where(
            and(
              eq(medications.id, existing.id),
              eq(medications.isActive, 1)
            )
          )
          .returning({ id: medications.id });
        if (!closed) {
          throw new MedicationMutationError(
            "Medication changed concurrently; refresh and try again",
            409
          );
        }
      }
      const [newVersion] = await tx
        .insert(medications)
        .values({ ...plan.createValues, createdAt: now })
        .returning();
      return {
        row: newVersion,
        versioned: true,
        cancelledVersion: false,
      };
    });

    return NextResponse.json({
      success: true,
      id: result.row.id,
      medication: result.row,
      versioned: result.versioned,
      cancelledVersion: result.cancelledVersion,
    });
  } catch (error) {
    if (error instanceof MedicationMutationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (isMedicationLineageConflict(error)) {
      return NextResponse.json(
        { error: "Medication changed concurrently; refresh and try again" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
