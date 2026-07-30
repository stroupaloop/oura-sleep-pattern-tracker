import { shiftIsoDay } from "@/lib/date-utils";

const DEFAULT_RANGE_DAYS = 90;
const SUPPORTED_RANGE_DAYS = new Set([30, 90, 180, 365]);

export function resolveLifeChartRange(value: string | undefined): number {
  const parsed = Number(value);
  return SUPPORTED_RANGE_DAYS.has(parsed) ? parsed : DEFAULT_RANGE_DAYS;
}

export function getLifeChartStartDay(
  today: string,
  rangeDays: number
): string {
  if (!Number.isInteger(rangeDays) || rangeDays < 1) {
    throw new Error("Invalid Life Chart date range");
  }
  const startDay = shiftIsoDay(today, -(rangeDays - 1));
  if (!startDay) {
    throw new Error("Invalid Life Chart date range");
  }
  return startDay;
}

export function collectLifeChartDays(
  ...sources: ReadonlyArray<ReadonlyArray<{ day: string }>>
): string[] {
  return Array.from(
    new Set(sources.flatMap((source) => source.map((row) => row.day)))
  ).sort();
}
