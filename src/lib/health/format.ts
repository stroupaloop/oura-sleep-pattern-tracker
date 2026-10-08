import { APP_TIME_ZONE, shiftIsoDay } from "@/lib/date-utils";

function formatDay(day: string, withWeekday: boolean): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...(withWeekday ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * Oura dates a night by the morning it ends, so a bare date is ambiguous;
 * this names both sides: "Tue, Sep 30 → Wed, Oct 1".
 */
export function formatNightLabel(
  day: string,
  { weekday = true }: { weekday?: boolean } = {}
): string {
  const evening = shiftIsoDay(day, -1);
  if (!evening) return formatDay(day, weekday);
  return `${formatDay(evening, weekday)} → ${formatDay(day, weekday)}`;
}

/** "7:42 AM" today, otherwise "Sep 29, 5:01 PM". */
export function formatSyncedAt(seconds: number, today: string): string {
  const instant = new Date(seconds * 1000);
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
  }).format(instant);
  return instant.toLocaleString("en-US", {
    timeZone: APP_TIME_ZONE,
    ...(day === today ? {} : { month: "short", day: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Before this ET hour, last night may simply not have synced yet. */
export const MORNING_ENDS_ET_HOUR = 12;

/** The current hour in ET, 0-23. */
export function currentEtHour(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  );
}
