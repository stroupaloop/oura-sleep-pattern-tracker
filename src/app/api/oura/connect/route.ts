import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOuraAuthUrl } from "@/lib/oura/oauth";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = getOuraAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oura_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return response;
}
