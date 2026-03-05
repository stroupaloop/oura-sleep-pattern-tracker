import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "noreply@resend.dev";
  const to = process.env.ALLOWED_EMAILS?.split(",")[0]?.trim();

  if (!apiKey || !to) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY or ALLOWED_EMAILS" });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Test email from Sleep Tracker",
        html: "<p>If you see this, Resend is working.</p>",
      }),
    });

    const body = await res.json();
    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      from,
      to,
      response: body,
    });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : String(e),
      from,
      to,
    });
  }
}
