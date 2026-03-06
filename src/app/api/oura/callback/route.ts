import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/oura/oauth";
import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get("oura_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=state_mismatch", request.url)
    );
  }

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/settings?error=${error}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=no_code", request.url)
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const now = Math.floor(Date.now() / 1000);

    await db.delete(oauthTokens);
    await db.insert(oauthTokens).values({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: now + tokens.expires_in,
      scope: "email personal daily heartrate spo2",
      updatedAt: now,
    });

    const response = NextResponse.redirect(
      new URL("/dashboard/settings?connected=1", request.url)
    );
    response.cookies.set("oura_oauth_state", "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (err) {
    console.error("Oura OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=token_exchange", request.url)
    );
  }
}
