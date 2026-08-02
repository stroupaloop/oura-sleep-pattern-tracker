import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dailyMood } from "@/lib/db/schema";
import { eq, gte, lte, and } from "drizzle-orm";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { parseMoodWrite } from "@/lib/mood-write";

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();

  try {
    const parsed = parseMoodWrite(await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { day, fields } = parsed;
    const now = Math.floor(Date.now() / 1000);
    const [existing] = await db
      .select({ id: dailyMood.id })
      .from(dailyMood)
      .where(eq(dailyMood.day, day))
      .limit(1);

    if (existing) {
      await db
        .update(dailyMood)
        .set({ ...fields, updatedAt: now })
        .where(eq(dailyMood.id, existing.id));
    } else {
      if (fields.moodScore === undefined) {
        return NextResponse.json(
          { error: "Choose a mood before adding other details" },
          { status: 400 }
        );
      }
      await db.insert(dailyMood).values({
        day,
        moodScore: fields.moodScore,
        energyScore: fields.energyScore ?? null,
        irritabilityScore: fields.irritabilityScore ?? null,
        anxietyScore: fields.anxietyScore ?? null,
        sleepSubjective: fields.sleepSubjective ?? null,
        notes: fields.notes ?? null,
        tags: fields.tags ?? null,
        episodeState: fields.episodeState ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true, savedAt: new Date(now * 1000).toISOString() });
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
