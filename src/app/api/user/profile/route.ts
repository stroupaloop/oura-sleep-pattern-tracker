import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { bipolarType } = body as { bipolarType?: string };

  if (!bipolarType || !["bp1", "bp2", "unspecified"].includes(bipolarType)) {
    return NextResponse.json(
      { error: "Invalid bipolarType. Must be 'bp1', 'bp2', or 'unspecified'" },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({ bipolarType })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ success: true, bipolarType });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({ bipolarType: users.bipolarType })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    bipolarType: rows[0]?.bipolarType ?? "unspecified",
  });
}
