import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { isAdminEmail } from "@/lib/access";
import { getNowUnixSeconds } from "@/lib/date-utils";
import {
  loadFallbackSetting,
  saveFallbackSetting,
} from "@/lib/thoughts-fallback-setting";

export async function PUT(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();
  if (!user.email || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be true or false" },
      { status: 400 }
    );
  }

  try {
    await saveFallbackSetting(
      body.enabled,
      user.email.toLowerCase(),
      getNowUnixSeconds()
    );
    return NextResponse.json(await loadFallbackSetting());
  } catch (error) {
    console.error("Failed to save the automatic thought switch:", error);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
}
