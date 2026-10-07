const CARE_TEAM = "Reach out to your care team if you notice changes";

const HIGHER_ACTIVATION = [
  "Track your mood and energy levels today",
  "Maintain your regular bedtime tonight",
  CARE_TEAM,
] as const;

const LOWER_ACTIVATION = [
  "Try to maintain regular sleep and wake times",
  "If you feel up to it, consider light physical activity today",
  CARE_TEAM,
] as const;

const NO_CLEAR_DIRECTION = [
  "Log today's mood and any medications",
  "Keep tonight's bedtime and wake time close to your usual",
  "If this keeps going, or you feel different, talk with your care team",
] as const;

/**
 * What the alerts page suggests beside a flagged pattern, by its direction.
 * Written when the page renders, not stored with the flag, so a change to the
 * wording reaches every flag. A flag with no dominant direction can as easily
 * be illness or stress as a mood shift, so it gets the neutral set and
 * nothing that pushes activity.
 */
export function describePatternAdvice(
  direction: string | null | undefined
): readonly string[] {
  if (direction === "hyper") return HIGHER_ACTIVATION;
  if (direction === "hypo") return LOWER_ACTIVATION;
  return NO_CLEAR_DIRECTION;
}
