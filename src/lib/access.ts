function parseEmailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
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
