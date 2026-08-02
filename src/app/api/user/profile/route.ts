import { NextResponse } from "next/server";
import { auth, isPrimarySensitiveUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrimarySensitiveUser(session.user.email)) {
    return NextResponse.json(
      {
        error:
          "Only the primary private-data owner can update the detection profile",
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const { bipolarType } = body as { bipolarType?: string };

  if (!bipolarType || !["bp1", "bp2", "unspecified"].includes(bipolarType)) {
    return NextResponse.json(
      { error: "Invalid bipolarType. Must be 'bp1', 'bp2', or 'unspecified'" },
      { status: 400 }
    );
  }

  const currentRows = await db
    .select({ bipolarType: users.bipolarType })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const previousBipolarType =
    currentRows[0]?.bipolarType ?? "unspecified";

  await db
    .update(users)
    .set({ bipolarType })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({
    success: true,
    bipolarType,
    changed: previousBipolarType !== bipolarType,
    reprocessingRequired: true,
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isPrimarySensitiveUser(session.user.email)) {
    return NextResponse.json(
      {
        error:
          "Only the primary private-data owner can view the detection profile",
      },
      { status: 403 }
    );
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
