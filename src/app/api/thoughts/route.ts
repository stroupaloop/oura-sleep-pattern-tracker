import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { thoughts } from "@/lib/db/schema";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { isAuthorEmail } from "@/lib/access";
import { parseThoughtWrite } from "@/lib/thoughts-write";
import { getTodayET } from "@/lib/date-utils";

export async function POST(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();
  if (!isAuthorEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    const parsed = parseThoughtWrite(body ?? {});
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    await db.insert(thoughts).values({
      day: getTodayET(),
      kind: parsed.fields.kind,
      source: "manual",
      note: parsed.fields.note,
      link: parsed.fields.link,
      createdAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to record thought:", error);
    return NextResponse.json(
      { error: "Failed to record thought" },
      { status: 500 }
    );
  }
}
