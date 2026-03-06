import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyMood } from "@/lib/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { day, moodScore, energyScore, irritabilityScore, anxietyScore, sleepSubjective, notes, tags } = body;

    if (!day || moodScore === undefined || moodScore === null) {
      return NextResponse.json({ error: "day and moodScore are required" }, { status: 400 });
    }
    if (moodScore < -3 || moodScore > 3) {
      return NextResponse.json({ error: "moodScore must be between -3 and +3" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);

    await db
      .insert(dailyMood)
      .values({
        day,
        moodScore,
        energyScore: energyScore ?? null,
        irritabilityScore: irritabilityScore ?? null,
        anxietyScore: anxietyScore ?? null,
        sleepSubjective: sleepSubjective ?? null,
        notes: notes ?? null,
        tags: tags ? JSON.stringify(tags) : null,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: dailyMood.day,
        set: {
          moodScore: sql`excluded.mood_score`,
          energyScore: sql`excluded.energy_score`,
          irritabilityScore: sql`excluded.irritability_score`,
          anxietyScore: sql`excluded.anxiety_score`,
          sleepSubjective: sql`excluded.sleep_subjective`,
          notes: sql`excluded.notes`,
          tags: sql`excluded.tags`,
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
    const day = searchParams.get("day");

    if (day) {
      const rows = await db.select().from(dailyMood).where(eq(dailyMood.day, day)).limit(1);
      return NextResponse.json(rows[0] ?? null);
    }

    const conditions = [];
    if (startDate) conditions.push(gte(dailyMood.day, startDate));
    if (endDate) conditions.push(lte(dailyMood.day, endDate));

    const rows = await db
      .select()
      .from(dailyMood)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(dailyMood.day);

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
