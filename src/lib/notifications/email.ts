export interface SendEmailOptions {
  /** Plain-text alternative. A body with no text part scores badly as spam. */
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options: SendEmailOptions = {}
) {
  const apiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "noreply@resend.dev";

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const payload: Record<string, unknown> = { from, to, subject, html };
  if (options.text) payload.text = options.text;
  if (options.replyTo) payload.reply_to = options.replyTo;
  if (options.headers) payload.headers = options.headers;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json();
    throw new Error(`Resend error ${res.status}: ${JSON.stringify(body)}`);
  }

  return res.json();
}
