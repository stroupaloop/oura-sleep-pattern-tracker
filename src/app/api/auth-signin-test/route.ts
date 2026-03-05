import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.NEXTAUTH_URL
    ?? process.env.AUTH_URL
    ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

  const results: Record<string, string> = {};
  results.NEXTAUTH_URL = process.env.NEXTAUTH_URL ?? "not set";
  results.AUTH_URL = process.env.AUTH_URL ?? "not set";
  results.VERCEL_URL = process.env.VERCEL_URL ?? "not set";
  results.resolved_base = baseUrl;

  // Try to POST to the signin endpoint like the form does
  try {
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
    const csrfText = await csrfRes.text();
    results.csrf_status = `${csrfRes.status}`;
    results.csrf_body = csrfText.substring(0, 200);
  } catch (e) {
    results.csrf_error = e instanceof Error ? e.message : String(e);
  }

  // Try providers endpoint
  try {
    const provRes = await fetch(`${baseUrl}/api/auth/providers`);
    const provText = await provRes.text();
    results.providers_status = `${provRes.status}`;
    results.providers_body = provText.substring(0, 500);
  } catch (e) {
    results.providers_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(results);
}
