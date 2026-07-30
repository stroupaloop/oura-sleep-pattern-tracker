import { NextRequest, NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { exchangeCodeForTokens, resolveOuraScope } from "@/lib/oura/oauth";
import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!isSensitiveUser(session.user.email)) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=forbidden", request.url)
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const grantedScope = request.nextUrl.searchParams.get("scope");
  const storedState = request.cookies.get("oura_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=state_mismatch", request.url)
    );
  }

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/settings?error=${encodeURIComponent(error)}`,
        request.url
      )
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

    const values = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: now + tokens.expires_in,
      scope: resolveOuraScope(grantedScope, tokens.scope),
      updatedAt: now,
    };
    const [existingToken] = await db
      .select({ id: oauthTokens.id })
      .from(oauthTokens)
      .limit(1);
    if (existingToken) {
      await db
        .update(oauthTokens)
        .set(values)
        .where(eq(oauthTokens.id, existingToken.id));
    } else {
      await db.insert(oauthTokens).values(values);
    }

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
