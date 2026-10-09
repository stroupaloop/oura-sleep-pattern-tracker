/**
 * Her usual is drawn from the nights before the latest two weeks, so a
 * stretch of unusual nights is still measured against how she was before it
 * rather than against itself. A short, recent-only baseline absorbed a
 * sustained change within a few weeks and the pattern check went quiet while
 * it was still going on.
 */
export const BASELINE_DAYS = 90;
export const BASELINE_GUARD_DAYS = 14;

export function describeBaselineWindow(
  baselineDays = BASELINE_DAYS,
  guardDays = BASELINE_GUARD_DAYS
): string {
  return `the ${baselineDays} nights before the latest ${guardDays}`;
}
