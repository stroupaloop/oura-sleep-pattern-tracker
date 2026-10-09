export type FlagTier = "watch" | "warning" | "alert";

/**
 * Watch and Warning keep their unbroken runs of concerning nights. They have
 * the lowest evidence bars, and counting scattered nights there raised false
 * flags (about 45% more Watch runs and 80% more Warning runs in simulated
 * steady years) without flagging real shifts any sooner.
 *
 * Alert may skip a night: its bar is high enough that two off nights in the
 * last seven are safe, and a strong pattern is not forgotten for one good
 * night.
 */
export const ALERT_SPAN_DAYS = 7;

/**
 * The two-week span clinicians use for a depressive episode. It is read only
 * for a lower-activation lean: a slide into longer sleep and less activity
 * is slow, and a week of it can look like an ordinary week.
 */
export const LOWER_VIEW_DAYS = 14;

/** Nights out of the last 14, leaning lower, that each tier asks for. */
export const LOWER_VIEW_MIN_NIGHTS: Record<FlagTier, number> = {
  watch: 8,
  warning: 10,
  alert: 12,
};

export interface Persistence {
  /** Concerning nights counted. */
  nights: number;
  /** Calendar nights counted over, ending on the assessed night. */
  span: number;
}

export interface ScoredNight {
  day: string;
  compositeScore: number;
  /** Signed lean of the night: positive toward higher activation. */
  activation?: number;
}

export interface Lean {
  direction: "hyper" | "hypo";
  /** A night counts toward the lean when its own score passes this. */
  margin: number;
}

function shiftCalendarDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Concerning nights among the last `span` calendar nights, ending on the
 * latest scored one. A night with no data counts as not concerning, so a gap
 * never helps a pattern along. With a lean, a night counts only if it also
 * leans that way; a night scored without a lean (older stored results) is
 * taken at its composite score alone.
 */
export function concerningNightsInSpan(
  nights: readonly ScoredNight[],
  concernThreshold: number,
  span: number,
  lean?: Lean
): number {
  const latest = nights[nights.length - 1];
  if (!latest) return 0;
  const first = shiftCalendarDay(latest.day, -(span - 1));
  const sign = lean ? (lean.direction === "hyper" ? 1 : -1) : 0;
  return nights.filter(
    (night) =>
      night.day >= first &&
      night.day <= latest.day &&
      night.compositeScore > concernThreshold &&
      (!lean || night.activation == null || night.activation * sign > lean.margin)
  ).length;
}

/** "2 of the last 3 nights", or "each of the last 3 nights" when none was missed. */
export function describePersistence({ nights, span }: Persistence): string {
  if (nights >= span) return `each of the last ${span} nights`;
  return `${nights} of the last ${span} nights`;
}
