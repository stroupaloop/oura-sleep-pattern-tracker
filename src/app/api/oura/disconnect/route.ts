import { NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSensitiveUser(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(oauthTokens);

  return NextResponse.json({ success: true });
}
