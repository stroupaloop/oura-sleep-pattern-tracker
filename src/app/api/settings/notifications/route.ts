import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSettings } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

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
    const { type, destination, reminderHour } = body;

    if (!type || !destination) {
      return NextResponse.json({ error: "type and destination are required" }, { status: 400 });
    }
    if (type !== "email" && type !== "sms") {
      return NextResponse.json({ error: "type must be email or sms" }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    await db.run(
      sql`INSERT INTO notification_settings (type, destination, enabled, reminder_hour, created_at) VALUES (${type}, ${destination}, 1, ${reminderHour ?? 22}, ${now})`
    );

    return NextResponse.json({ success: true });
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
    const { id, enabled, reminderHour } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updates: Record<string, number> = {};
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    if (reminderHour !== undefined) updates.reminderHour = reminderHour;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    await db
      .update(notificationSettings)
      .set(updates)
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
