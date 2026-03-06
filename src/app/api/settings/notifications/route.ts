import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(notificationSettings);
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
    const { type, destination } = body;

    if (!type || !destination) {
      return NextResponse.json({ error: "type and destination are required" }, { status: 400 });
    }
    if (type !== "email" && type !== "sms") {
      return NextResponse.json({ error: "type must be email or sms" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    const result = await db
      .insert(notificationSettings)
      .values({ type, destination, enabled: 1, createdAt: now })
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
    const { id, enabled } = body;

    if (!id || enabled === undefined) {
      return NextResponse.json({ error: "id and enabled are required" }, { status: 400 });
    }

    await db
      .update(notificationSettings)
      .set({ enabled: enabled ? 1 : 0 })
      .where(eq(notificationSettings.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(notificationSettings).where(eq(notificationSettings.id, Number(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
