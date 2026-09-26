import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { thoughts } from "@/lib/db/schema";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { isAuthorEmail } from "@/lib/access";
import { parseThoughtEdit } from "@/lib/thoughts-write";
import { getNowUnixSeconds } from "@/lib/date-utils";
import { unixToEtDay } from "@/lib/thoughts-schedule";

async function requireAuthor() {
  const user = await requireApiUser();
  if (!user) return { error: unauthorizedResponse() };
  if (!isAuthorEmail(user.email)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { error: null };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuthor();
  if (guard.error) return guard.error;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => null);
    const now = getNowUnixSeconds();
    const parsed = parseThoughtEdit(body ?? {}, now);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const existing = await db
      .select({ id: thoughts.id })
      .from(thoughts)
      .where(eq(thoughts.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db
      .update(thoughts)
      .set({
        note: parsed.fields.note,
        link: parsed.fields.link,
        createdAt: parsed.fields.createdAt,
        // The calendar day drives the grid, so it follows the timestamp.
        day: unixToEtDay(parsed.fields.createdAt),
        updatedAt: now,
      })
      .where(eq(thoughts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to edit thought:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuthor();
  if (guard.error) return guard.error;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const result = await db.delete(thoughts).where(eq(thoughts.id, id));
    if (!result.rowsAffected) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete thought:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
