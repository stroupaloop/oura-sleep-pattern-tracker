export const APP_TIME_ZONE = "America/New_York";

export function getTodayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
  }).format(new Date());
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
