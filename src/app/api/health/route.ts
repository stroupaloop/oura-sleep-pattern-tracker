import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars
  checks.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL ? "set" : "MISSING";
  checks.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ? "set" : "MISSING";
  checks.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ? "set" : "MISSING";
  checks.RESEND_API_KEY = process.env.RESEND_API_KEY ? "set" : "MISSING";
  checks.ALLOWED_EMAILS = process.env.ALLOWED_EMAILS ?? "MISSING";
  checks.OURA_CLIENT_ID = process.env.OURA_CLIENT_ID ? "set" : "MISSING";

  // Check DB connection
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    checks.db_connection = `ok (${result[0].count} users)`;
  } catch (e) {
    checks.db_connection = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json(checks);
}
