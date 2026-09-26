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

export interface ThoughtEditFields {
  note: string | null;
  link: string | null;
  /** Unix seconds; when present the stored day is recomputed from it. */
  createdAt: number;
}

export type ParsedThoughtEdit =
  | { ok: true; fields: ThoughtEditFields }
  | { ok: false; error: string };

/** Guards against a fat-fingered year knocking an entry off the grid. */
export const EARLIEST_EDIT = Date.parse("2020-01-01T00:00:00Z") / 1000;

export function parseThoughtEdit(
  value: unknown,
  nowUnixSeconds: number
): ParsedThoughtEdit {
  const base = parseThoughtWrite(value);
  if (!base.ok) return base;

  const body = value as Record<string, unknown>;
  if (!Object.hasOwn(body, "createdAt") || body.createdAt === null) {
    return { ok: false, error: "createdAt is required" };
  }
  const createdAt = Number(body.createdAt);
  if (!Number.isInteger(createdAt)) {
    return { ok: false, error: "createdAt must be a whole number of seconds" };
  }
  if (createdAt < EARLIEST_EDIT) {
    return { ok: false, error: "That date is too far in the past" };
  }
  // A minute of slack absorbs clock skew between the browser and the server.
  if (createdAt > nowUnixSeconds + 60) {
    return { ok: false, error: "That date is in the future" };
  }

  return {
    ok: true,
    fields: {
      note: base.fields.note,
      link: base.fields.link,
      createdAt,
    },
  };
}
