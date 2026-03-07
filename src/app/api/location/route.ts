import { NextRequest, NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dailyLocation } from "@/lib/db/schema";
import { sql, gte, lte, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !isSensitiveUser(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startDate = request.nextUrl.searchParams.get("start_date");
  const endDate = request.nextUrl.searchParams.get("end_date");

  const conditions = [];
  if (startDate) conditions.push(gte(dailyLocation.day, startDate));
  if (endDate) conditions.push(lte(dailyLocation.day, endDate));

  const rows = await db
    .select()
    .from(dailyLocation)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(dailyLocation.day);

  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !isSensitiveUser(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { day, city, description } = body;

  if (!day) {
    return NextResponse.json({ error: "day is required" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  await db
    .insert(dailyLocation)
    .values({ day, city: city ?? null, description: description ?? null, createdAt: now })
    .onConflictDoUpdate({
      target: dailyLocation.day,
      set: {
        city: sql`excluded.city`,
        description: sql`excluded.description`,
      },
    });

  return NextResponse.json({ success: true, day });
}
