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

/**
 * Everyone allowed to write thoughts. THOUGHTS_AUTHOR_EMAILS takes a
 * comma-separated list; the older singular name still works. With neither
 * set it falls back to the first allowed email, so a misconfiguration grants
 * nothing extra rather than opening writes to every signed-in viewer.
 */
export function getAuthorEmails(): string[] {
  const explicit = parseEmailList(
    process.env.THOUGHTS_AUTHOR_EMAILS ?? process.env.THOUGHTS_AUTHOR_EMAIL
  );
  if (explicit.length > 0) return explicit;
  const first = getAllowedEmails()[0];
  return first ? [first] : [];
}

/** The first author, used where a single address is needed (alert recipient). */
export function getAuthorEmail(): string | null {
  return getAuthorEmails()[0] ?? null;
}

export function isAuthorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAuthorEmails().includes(email.toLowerCase());
}
