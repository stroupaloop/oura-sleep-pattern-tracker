export const THOUGHT_KINDS = ["thought", "miss"] as const;
export type ThoughtKind = (typeof THOUGHT_KINDS)[number];

export const MAX_NOTE_LENGTH = 2000;
export const MAX_LINK_LENGTH = 2048;

export interface ThoughtFields {
  kind: ThoughtKind;
  note: string | null;
  link: string | null;
}

export type ParsedThoughtWrite =
  | { ok: true; fields: ThoughtFields }
  | { ok: false; error: string };

function normalizeLink(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url.toString();
}

export function parseThoughtWrite(value: unknown): ParsedThoughtWrite {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Invalid request body" };
  }
  const body = value as Record<string, unknown>;

  let kind: ThoughtKind = "thought";
  if (Object.hasOwn(body, "kind") && body.kind !== null) {
    if (
      typeof body.kind !== "string" ||
      !THOUGHT_KINDS.includes(body.kind as ThoughtKind)
    ) {
      return { ok: false, error: "kind must be one of: thought, miss" };
    }
    kind = body.kind as ThoughtKind;
  }

  let note: string | null = null;
  if (Object.hasOwn(body, "note") && body.note !== null) {
    if (typeof body.note !== "string") {
      return { ok: false, error: "note must be text" };
    }
    const trimmed = body.note.trim();
    if (trimmed.length > MAX_NOTE_LENGTH) {
      return {
        ok: false,
        error: `note must be ${MAX_NOTE_LENGTH} characters or fewer`,
      };
    }
    note = trimmed.length > 0 ? trimmed : null;
  }

  let link: string | null = null;
  if (Object.hasOwn(body, "link") && body.link !== null) {
    if (typeof body.link !== "string") {
      return { ok: false, error: "link must be text" };
    }
    const trimmed = body.link.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > MAX_LINK_LENGTH) {
        return {
          ok: false,
          error: `link must be ${MAX_LINK_LENGTH} characters or fewer`,
        };
      }
      const normalized = normalizeLink(trimmed);
      if (!normalized) {
        return { ok: false, error: "link must be a valid http(s) URL" };
      }
      link = normalized;
    }
  }

  return { ok: true, fields: { kind, note, link } };
}
