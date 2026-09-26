export const APP_TIME_ZONE = "America/New_York";

export function getTodayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
  }).format(new Date());
}

export function getNowUnixSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function getNowET(): Date {
  const etStr = new Date().toLocaleString("en-US", {
    timeZone: APP_TIME_ZONE,
  });
  return new Date(etStr);
}

export function getIsoTimeZoneClockMinutes(
  timestamp: string,
  timeZone = APP_TIME_ZONE
): number | null {
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp)) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hours = Number(
    parts.find((part) => part.type === "hour")?.value
  );
  const minutes = Number(
    parts.find((part) => part.type === "minute")?.value
  );
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export function getDayOffsetClockMinutes(
  day: string,
  offsetSeconds: number,
  sourceTimestamp: string,
  timeZone = APP_TIME_ZONE
): number | null {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(offsetSeconds)
  ) {
    return null;
  }
  const dateOnly = new Date(`${day}T12:00:00Z`);
  if (
    Number.isNaN(dateOnly.getTime()) ||
    dateOnly.toISOString().slice(0, 10) !== day
  ) {
    return null;
  }

  const zoneMatch = sourceTimestamp.match(/(Z|[+-]\d{2}:?\d{2})$/);
  if (!zoneMatch) return null;
  const sourceZone =
    zoneMatch[1] === "Z"
      ? "Z"
      : zoneMatch[1].includes(":")
        ? zoneMatch[1]
        : `${zoneMatch[1].slice(0, 3)}:${zoneMatch[1].slice(3)}`;
  const sourceMidnight = Date.parse(`${day}T00:00:00${sourceZone}`);
  if (!Number.isFinite(sourceMidnight)) return null;

  return getIsoTimeZoneClockMinutes(
    new Date(sourceMidnight + offsetSeconds * 1000).toISOString(),
    timeZone
  );
}

export function formatIsoTimeInAppTimeZone(
  timestamp: string,
  locale = "en-US"
): string | null {
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp)) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatIsoDay(
  day: string,
  locale = "en-US"
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function shiftIsoDay(day: string, offset: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isInteger(offset)) {
    return null;
  }
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function zoneOffsetMs(timestampMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(timestampMs));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return (
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second")
    ) - timestampMs
  );
}

/**
 * Unix seconds rendered as the value a <input type="datetime-local"> expects,
 * in app time. The input has no time zone of its own, so it must be handed
 * wall-clock text rather than an instant.
 */
export function unixToEtInputValue(
  unixSeconds: number,
  timeZone = APP_TIME_ZONE
): string | null {
  if (!Number.isFinite(unixSeconds)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(unixSeconds * 1000));
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  const time = `${get("hour")}:${get("minute")}`;
  if (day.includes("undefined") || time.includes("undefined")) return null;
  return `${day}T${time}`;
}

/** Inverse of unixToEtInputValue; returns null on malformed input. */
export function etInputValueToUnix(
  value: string,
  timeZone = APP_TIME_ZONE
): number | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, day, hh, mm] = match;
  const naive = Date.parse(`${day}T${hh}:${mm}:00Z`);
  if (!Number.isFinite(naive)) return null;

  // Correct for the offset, then re-check in case the first guess landed on
  // the far side of a DST transition.
  const first = zoneOffsetMs(naive, timeZone);
  let resolved = naive - first;
  const second = zoneOffsetMs(resolved, timeZone);
  if (second !== first) resolved = naive - second;
  return Math.floor(resolved / 1000);
}
