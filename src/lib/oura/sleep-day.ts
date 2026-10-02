import { APP_TIME_ZONE, shiftIsoDay } from "../date-utils";

const SLEEP_DAY_BOUNDARY_MINUTES = 18 * 60;

function getLocalDayAndClockMinutes(
  timestamp: string,
  timeZone: string
): { day: string; clockMinutes: number } | null {
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp)) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = Number(value("hour"));
  const minute = Number(value("minute"));

  if (
    !year ||
    !month ||
    !day ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    day: `${year}-${month}-${day}`,
    clockMinutes: hour * 60 + minute,
  };
}

export function getOuraSleepDayForTimestamp(
  timestamp: string,
  timeZone = APP_TIME_ZONE
): string | null {
  const local = getLocalDayAndClockMinutes(timestamp, timeZone);
  if (!local) return null;
  return local.clockMinutes >= SLEEP_DAY_BOUNDARY_MINUTES
    ? shiftIsoDay(local.day, 1)
    : local.day;
}
