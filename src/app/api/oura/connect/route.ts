import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOuraAuthUrl } from "@/lib/oura/oauth";
import { randomBytes } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login"));
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = getOuraAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
