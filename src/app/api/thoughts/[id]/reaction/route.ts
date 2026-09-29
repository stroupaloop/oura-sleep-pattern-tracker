import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { thoughtReactions, thoughts } from "@/lib/db/schema";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { isAuthorEmail } from "@/lib/access";
import { getNowUnixSeconds } from "@/lib/date-utils";
import { isAllowedReaction } from "@/lib/reaction-emojis";
import { queueReactionAlert } from "@/lib/notifications/reaction-notify";

/** Readers react; authors see the reactions but do not leave them. */
async function requireReader() {
  const user = await requireApiUser();
  if (!user?.email) return { error: unauthorizedResponse(), email: null };
  if (isAuthorEmail(user.email)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      email: null,
    };
  }
  return { error: null, email: user.email.toLowerCase() };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireReader();
  if (guard.error) return guard.error;
  const email = guard.email;

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const emoji = (body as { emoji?: unknown } | null)?.emoji;
  if (!isAllowedReaction(emoji)) {
    return NextResponse.json({ error: "Unsupported reaction" }, { status: 400 });
  }

  try {
    const [thought] = await db
      .select({ id: thoughts.id })
      .from(thoughts)
      .where(eq(thoughts.id, id))
      .limit(1);
    if (!thought) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = getNowUnixSeconds();
    await db
      .insert(thoughtReactions)
      .values({
        thoughtId: id,
        email,
        emoji,
        notified: 0,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [thoughtReactions.thoughtId, thoughtReactions.email],
        set: { emoji, notified: 0, updatedAt: now },
      });

    queueReactionAlert({ email, savedAt: now });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save reaction:", error);
    return NextResponse.json(
      { error: "Failed to save reaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireReader();
  if (guard.error) return guard.error;

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await db
      .delete(thoughtReactions)
      .where(
        and(
          eq(thoughtReactions.thoughtId, id),
          eq(thoughtReactions.email, guard.email)
        )
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove reaction:", error);
    return NextResponse.json(
      { error: "Failed to remove reaction" },
      { status: 500 }
    );
  }
}
