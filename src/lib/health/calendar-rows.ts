import { shiftIsoDay } from "@/lib/date-utils";

/**
 * One row for every calendar day from the first day that has a row through
 * `range.end`. A day without a row gets `empty(day)`, so a missing night is
 * drawn as a gap instead of its neighbours being joined across it. Rows
 * outside the range, and days before the first row, are left off. Days are
 * app-time `YYYY-MM-DD` strings, stepped as dates rather than 24-hour spans.
 */
export function fillCalendarDays<T extends { day: string }>(
  rows: readonly T[],
  range: { start: string; end: string },
  empty: (day: string) => T
): T[] {
  if (
    shiftIsoDay(range.start, 0) == null ||
    shiftIsoDay(range.end, 0) == null
  ) {
    return [];
  }

  const byDay = new Map<string, T>();
  for (const row of rows) {
    if (row.day >= range.start && row.day <= range.end) {
      byDay.set(row.day, row);
    }
  }
  const first = [...byDay.keys()].sort()[0];
  if (first === undefined) return [];

  const filled: T[] = [];
  for (
    let day: string | null = first;
    day != null && day <= range.end;
    day = shiftIsoDay(day, 1)
  ) {
    filled.push(byDay.get(day) ?? empty(day));
  }
  return filled;
}
