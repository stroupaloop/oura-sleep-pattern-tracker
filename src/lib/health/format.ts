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

/**
 * A day on a chart axis: "Oct 9", or "Oct 9 ’25" when the chart covers more
 * than one year. The month is named so a label is not mistaken for a count.
 */
export function formatAxisDay(day: string, withYear = false): string {
  const label = formatDay(day, false);
  return withYear ? `${label} ’${day.slice(2, 4)}` : label;
}

/**
 * What a date axis needs, to spread onto Recharts' `XAxis`: month-named labels
 * (with the year once the days span two), the first and last kept, and room
 * between the rest so they do not run together.
 */
export function axisDayProps(days: ReadonlyArray<string>): {
  tickFormatter: (day: string) => string;
  interval: "preserveStartEnd";
  minTickGap: number;
} {
  const first = days[0]?.slice(0, 4);
  const last = days[days.length - 1]?.slice(0, 4);
  const withYear = first !== undefined && last !== undefined && first !== last;
  return {
    tickFormatter: (day) => formatAxisDay(day, withYear),
    interval: "preserveStartEnd",
    minTickGap: withYear ? 36 : 24,
  };
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
