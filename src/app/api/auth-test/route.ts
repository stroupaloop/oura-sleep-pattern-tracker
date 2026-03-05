import { NextResponse } from "next/server";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";

export async function GET() {
  const results: Record<string, string> = {};

  // Test 1: Can we create the adapter?
  try {
    const adapter = DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    });
    results.adapter_created = "ok";
    results.adapter_methods = Object.keys(adapter).join(", ");
  } catch (e) {
    results.adapter_created = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test 2: Can we create a verification token?
  try {
    const adapter = DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    });
    const token = await adapter.createVerificationToken!({
      identifier: "test@test.com",
      token: "test-token-" + Date.now(),
      expires: new Date(Date.now() + 86400000),
    });
    results.create_verification_token = `ok: ${JSON.stringify(token)}`;
  } catch (e) {
    results.create_verification_token = `ERROR: ${e instanceof Error ? e.stack ?? e.message : String(e)}`;
  }

  // Test 3: Auth secret
  results.has_auth_secret = process.env.AUTH_SECRET ? "yes" : "no";
  results.has_nextauth_secret = process.env.NEXTAUTH_SECRET ? "yes" : "no";
  results.secret_length = String(
    (process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "").length
  );

  // Test 4: Resend API key
  results.has_resend_key = (process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY) ? "yes" : "no";

  return NextResponse.json(results, { status: 200 });
}
