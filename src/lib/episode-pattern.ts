import { shiftIsoDay } from "@/lib/date-utils";

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
  lastFlaggedDay: string;
  /** A later night was checked and flagged nothing. */
  eased: boolean;
}

function newestDay(rows: readonly { day: string }[]): string {
  return rows.reduce((latest, row) => (row.day > latest ? row.day : latest), "");
}

/**
 * The strongest flagged tier since `sinceDay`, how many days were flagged and
 * when the last one was, or null when none were. Takes assessments newest
 * first, so a tie keeps the most recent day's direction.
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
  const lastFlaggedDay = newestDay(flagged);
  return {
    tier: strongest.tier,
    direction: strongest.direction,
    flaggedDays: flagged.length,
    lastFlaggedDay,
    eased: newestDay(assessments) > lastFlaggedDay,
  };
}

/**
 * Whether the pattern check has fallen more than a night behind. Oura dates a
 * night by the morning it ends, so a check through yesterday's night is as
 * current as it can be before today's data arrives; anything older means
 * newer nights have not reached the app. With no check on record there is
 * nothing to be behind.
 */
export function isPatternCheckBehind(
  latestCheckedDay: string | null,
  today: string
): boolean {
  if (!latestCheckedDay) return false;
  const newestExpected = shiftIsoDay(today, -1);
  return newestExpected != null && latestCheckedDay < newestExpected;
}
