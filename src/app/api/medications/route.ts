import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { medications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
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
  try {
    const body = await req.json();
    const { name, dosage, frequency, startDate } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await db
      .insert(medications)
      .values({
        name,
        dosage: dosage ?? null,
        frequency: frequency ?? "daily",
        isActive: 1,
        startDate: startDate ?? null,
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
  try {
    const body = await req.json();
    const { id, name, dosage, frequency, isActive, startDate, endDate } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (dosage !== undefined) updates.dosage = dosage;
    if (frequency !== undefined) updates.frequency = frequency;
    if (isActive !== undefined) updates.isActive = isActive;
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;

    await db.update(medications).set(updates).where(eq(medications.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
