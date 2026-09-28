const TIER_RANK: Record<string, number> = {
  alert: 3,
  warning: 2,
  watch: 1,
  none: 0,
};

export interface EpisodePatternSummary {
  tier: string;
  direction: string | null;
  flaggedDays: number;
}

/**
 * The strongest flagged tier since `sinceDay` and how many days were flagged,
 * or null when none were. Takes assessments newest first, so a tie keeps the
 * most recent day's direction.
 */
export function summarizeEpisodePattern(
  assessments: readonly { day: string; tier: string; direction: string | null }[],
  sinceDay: string
): EpisodePatternSummary | null {
  const flagged = assessments.filter(
    (assessment) => assessment.tier !== "none" && assessment.day >= sinceDay
  );
  if (flagged.length === 0) return null;

  const strongest = flagged.reduce((best, assessment) =>
    (TIER_RANK[assessment.tier] ?? 0) > (TIER_RANK[best.tier] ?? 0)
      ? assessment
      : best
  );
  return {
    tier: strongest.tier,
    direction: strongest.direction,
    flaggedDays: flagged.length,
  };
}
