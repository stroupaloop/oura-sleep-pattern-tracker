export function getTodayET(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

export function getNowET(): Date {
  const etStr = new Date().toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
  return new Date(etStr);
}

export function getIsoLocalClockMinutes(timestamp: string): number | null {
  const match = timestamp.match(
    /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/
  );
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
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

export function formatIsoLocalTime(
  timestamp: string,
  locale = "en-US"
): string | null {
  const clockMinutes = getIsoLocalClockMinutes(timestamp);
  if (clockMinutes == null) return null;

  const hours = Math.floor(clockMinutes / 60);
  const minutes = clockMinutes % 60;
  const clock = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(clock);
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
