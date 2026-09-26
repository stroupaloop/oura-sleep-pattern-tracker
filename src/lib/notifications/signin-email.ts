export interface SignInEmailInput {
  url: string;
  host: string;
  /** Minutes the link stays valid, for the body copy. */
  expiresInMinutes?: number;
}

export interface SignInEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Auth.js ships a default verification email whose body is essentially one
 * button and nothing else. A link-only body from a low-reputation sender is
 * one of the strongest spam signals there is, so this sends a named sender,
 * a real plain-text alternative, the destination shown as readable text, and
 * enough surrounding copy that the link is not the entire message.
 */
export function buildSignInEmail({
  url,
  host,
  expiresInMinutes = 24 * 60,
}: SignInEmailInput): SignInEmail {
  const hours = Math.round(expiresInMinutes / 60);
  const validFor =
    expiresInMinutes >= 120
      ? `${hours} hours`
      : `${Math.round(expiresInMinutes)} minutes`;

  const subject = `Your sign-in link for ${host}`;

  const text = [
    `Here is your sign-in link for ${host}.`,
    "",
    url,
    "",
    `The link works once and expires in ${validFor}.`,
    "If you did not ask to sign in, you can ignore this message —",
    "nobody can get in without opening the link above.",
  ].join("\n");

  const safeUrl = escapeHtml(url);
  const safeHost = escapeHtml(host);

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f6f6f7;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <tr><td>
      <p style="margin:0 0 16px;font-size:18px;font-weight:600">Sign in to ${safeHost}</p>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#444">
        You asked to sign in. Use the button below and you will be taken
        straight in — there is no password to remember.
      </p>
      <p style="margin:0 0 20px">
        <a href="${safeUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600">Sign in</a>
      </p>
      <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#666">
        If the button does not work, copy this address into your browser:<br>
        <span style="color:#444;word-break:break-all">${safeUrl}</span>
      </p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#666">
        The link works once and expires in ${validFor}.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#666">
        If you did not ask to sign in, you can ignore this message — nobody
        can get in without opening the link above.
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}
