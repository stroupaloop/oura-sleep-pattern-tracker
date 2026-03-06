export async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "noreply@resend.dev";

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(`Resend error ${res.status}: ${JSON.stringify(body)}`);
  }

  return res.json();
}
