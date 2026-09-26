/**
 * Strips one layer of wrapping quotes. Shell and dotenv loaders remove these,
 * but a value pasted into a hosting dashboard keeps them literally, which
 * would otherwise corrupt the first and last entries of a comma-separated
 * list and silently reject those addresses at sign-in.
 */
function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseEmailList(value: string | undefined): string[] {
  return unquote(value ?? "")
    .split(",")
    .map((email) => unquote(email).toLowerCase())
    .filter(Boolean);
}

export function getAllowedEmails(): string[] {
  return parseEmailList(process.env.ALLOWED_EMAILS);
}

export function isSensitiveEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return parseEmailList(process.env.SENSITIVE_EMAILS).includes(
    email.toLowerCase()
  );
}

export function getPrimarySensitiveEmail(): string | null {
  return parseEmailList(process.env.SENSITIVE_EMAILS)[0] ?? null;
}

export function isPrimarySensitiveEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  return email.toLowerCase() === getPrimarySensitiveEmail();
}

export function getAuthorEmail(): string | null {
  const explicit = (process.env.THOUGHTS_AUTHOR_EMAIL ?? "").trim().toLowerCase();
  if (explicit) return explicit;
  return getAllowedEmails()[0] ?? null;
}

export function isAuthorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const author = getAuthorEmail();
  if (!author) return false;
  return email.toLowerCase() === author;
}
