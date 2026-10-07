import { OPTIONAL_SCORES, type OptionalScores } from "@/lib/optional-scores";

/** Mood tags are stored as a JSON array; anything else reads as no tags. */
export function parseMoodTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

export function formatMoodTags(tags: readonly string[]): string {
  return tags.map((tag) => tag.replace(/_/g, " ")).join(", ");
}

export function formatMoodScore(score: number): string {
  return score > 0 ? `+${score}` : `${score}`;
}

/** The optional 1-5 check-in scores that were filled in, e.g. "Energy 4/5". */
export function formatOptionalScores(scores: OptionalScores): string[] {
  return OPTIONAL_SCORES.flatMap(({ key, label }) => {
    const value = scores[key];
    return value === null ? [] : [`${label} ${value}/5`];
  });
}
