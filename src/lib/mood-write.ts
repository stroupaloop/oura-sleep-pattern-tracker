export interface MoodFields {
  moodScore: number;
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
  sleepSubjective: number | null;
  notes: string | null;
  tags: string | null;
  episodeState: string | null;
}

export type ParsedMoodWrite =
  | { ok: true; day: string; fields: Partial<MoodFields> }
  | { ok: false; error: string };

const OPTIONAL_SCORES = [
  "energyScore",
  "irritabilityScore",
  "anxietyScore",
  "sleepSubjective",
] as const;

function isCalendarDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function parseMoodWrite(value: unknown): ParsedMoodWrite {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Invalid request body" };
  }
  const body = value as Record<string, unknown>;
  if (!isCalendarDay(body.day)) {
    return { ok: false, error: "A valid day is required" };
  }

  const fields: Partial<MoodFields> = {};
  if (Object.hasOwn(body, "moodScore")) {
    if (
      !Number.isInteger(body.moodScore) ||
      (body.moodScore as number) < -3 ||
      (body.moodScore as number) > 3
    ) {
      return { ok: false, error: "moodScore must be an integer from -3 to +3" };
    }
    fields.moodScore = body.moodScore as number;
  }

  for (const field of OPTIONAL_SCORES) {
    if (!Object.hasOwn(body, field)) continue;
    const score = body[field];
    if (
      score !== null &&
      (!Number.isInteger(score) || (score as number) < 1 || (score as number) > 5)
    ) {
      return { ok: false, error: `${field} must be null or an integer from 1 to 5` };
    }
    fields[field] = score as number | null;
  }

  if (Object.hasOwn(body, "notes")) {
    if (
      body.notes !== null &&
      (typeof body.notes !== "string" || body.notes.length > 5000)
    ) {
      return { ok: false, error: "notes must be null or at most 5000 characters" };
    }
    fields.notes =
      typeof body.notes === "string" && body.notes.trim().length > 0
        ? body.notes
        : null;
  }

  if (Object.hasOwn(body, "tags")) {
    if (
      body.tags !== null &&
      (!Array.isArray(body.tags) ||
        body.tags.length > 20 ||
        !body.tags.every(
          (tag) => typeof tag === "string" && tag.length > 0 && tag.length <= 50
        ))
    ) {
      return { ok: false, error: "tags must be an array of short strings" };
    }
    fields.tags =
      Array.isArray(body.tags) && body.tags.length > 0
        ? JSON.stringify(body.tags)
        : null;
  }

  if (Object.hasOwn(body, "episodeState")) {
    const state = body.episodeState;
    if (
      state !== null &&
      state !== "none" &&
      state !== "depressive" &&
      state !== "hypomanic" &&
      state !== "mixed"
    ) {
      return { ok: false, error: "Invalid episodeState" };
    }
    fields.episodeState = state as string | null;
  }

  if (Object.keys(fields).length === 0) {
    return { ok: false, error: "No mood fields were provided" };
  }
  return { ok: true, day: body.day, fields };
}
