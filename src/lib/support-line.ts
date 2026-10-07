export const SUPPORT_LINE = {
  name: "988 Suicide & Crisis Lifeline",
  number: "988",
  callHref: "tel:988",
  textHref: "sms:988",
  chatHref: "https://988lifeline.org/chat/",
} as const;

/** A mood logged at -2 ("Low") or lower. */
export const LOW_MOOD_SUPPORT_AT_OR_BELOW = -2;

export function moodNeedsSupportLine(
  moodScore: number | null | undefined
): boolean {
  return moodScore != null && moodScore <= LOW_MOOD_SUPPORT_AT_OR_BELOW;
}

/** A flagged pattern that is not clearly higher-activation: lower or mixed. */
export function patternNeedsSupportLine(
  patterns: readonly { tier: string; direction: string | null }[]
): boolean {
  return patterns.some(
    (pattern) => pattern.tier !== "none" && pattern.direction !== "hyper"
  );
}
