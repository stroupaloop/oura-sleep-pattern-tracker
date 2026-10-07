/**
 * The optional 1-5 check-in scores. Each is unanswered (null) until it is set,
 * so the daily log never holds an answer nobody gave. The end labels say what
 * 1 and 5 mean, since 5 is good for sleep quality and not for anxiety.
 */
export const OPTIONAL_SCORES = [
  { key: "energyScore", label: "Energy", low: "Low", high: "High" },
  { key: "irritabilityScore", label: "Irritability", low: "None", high: "A lot" },
  { key: "anxietyScore", label: "Anxiety", low: "None", high: "A lot" },
  { key: "sleepSubjective", label: "Sleep quality", low: "Poor", high: "Great" },
] as const;

export type OptionalScoreKey = (typeof OPTIONAL_SCORES)[number]["key"];
export type OptionalScores = Record<OptionalScoreKey, number | null>;

/** The four scores of a saved entry; no entry, or a missing field, is unanswered. */
export function optionalScoresOf(
  entry: Partial<OptionalScores> | null | undefined
): OptionalScores {
  return {
    energyScore: entry?.energyScore ?? null,
    irritabilityScore: entry?.irritabilityScore ?? null,
    anxietyScore: entry?.anxietyScore ?? null,
    sleepSubjective: entry?.sleepSubjective ?? null,
  };
}

/**
 * What a save sends: only the scores that differ from what is stored, a number
 * to set one and null to clear one. A score left alone is left out, so a saved
 * value stays and an unanswered one is never written.
 */
export function changedOptionalScores(
  current: OptionalScores,
  saved: OptionalScores
): Partial<OptionalScores> {
  const changes: Partial<OptionalScores> = {};
  for (const { key } of OPTIONAL_SCORES) {
    if (current[key] !== saved[key]) changes[key] = current[key];
  }
  return changes;
}
