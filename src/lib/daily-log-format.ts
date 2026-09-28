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
export function formatOptionalScores(scores: {
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
  sleepSubjective: number | null;
}): string[] {
  const entries: [string, number | null][] = [
    ["Energy", scores.energyScore],
    ["Irritability", scores.irritabilityScore],
    ["Anxiety", scores.anxietyScore],
    ["Sleep quality", scores.sleepSubjective],
  ];
  return entries
    .filter((entry): entry is [string, number] => entry[1] !== null)
    .map(([label, value]) => `${label} ${value}/5`);
}
