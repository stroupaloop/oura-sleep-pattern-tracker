import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { medicationLogs } from "@/lib/db/schema";
import { gte, lte, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { medicationId, day, taken } = body;

    if (!medicationId || !day || taken === undefined) {
      return NextResponse.json(
        { error: "medicationId, day, and taken are required" },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    await db
      .insert(medicationLogs)
      .values({
        medicationId,
        day,
        taken: taken ? 1 : 0,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: [medicationLogs.medicationId, medicationLogs.day],
        set: {
          taken: sql`excluded.taken`,
        },
      });

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
