import {
  APP_TIME_ZONE,
  getIsoTimeZoneClockMinutes,
} from "@/lib/date-utils";

interface StoredSleepTimeOffset {
  v: 1;
  day_tz: number;
  offset: number;
}

export function encodeSleepTimeOffset(
  offsetSeconds: number | null | undefined,
  dayTimezoneOffsetSeconds: number | null | undefined
): string | null {
  if (
    !isSafeInteger(offsetSeconds) ||
    !isSafeInteger(dayTimezoneOffsetSeconds)
  ) {
    return null;
  }

  return JSON.stringify({
    v: 1,
    day_tz: dayTimezoneOffsetSeconds,
    offset: offsetSeconds,
  } satisfies StoredSleepTimeOffset);
}

export function getSleepTimeClockMinutes(
  day: string,
  storedOffset: string | null | undefined,
  timeZone = APP_TIME_ZONE
): number | null {
  const dayStart = parseIsoDayStart(day);
  const stored = parseStoredSleepTimeOffset(storedOffset);
  if (dayStart == null || stored == null) return null;

  const instant =
    dayStart - stored.day_tz * 1000 + stored.offset * 1000;
  if (!Number.isSafeInteger(instant)) return null;
  const instantDate = new Date(instant);
  if (Number.isNaN(instantDate.getTime())) return null;

  return getIsoTimeZoneClockMinutes(
    instantDate.toISOString(),
    timeZone
  );
}

function parseStoredSleepTimeOffset(
  value: string | null | undefined
): StoredSleepTimeOffset | null {
  if (value == null) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed == null ||
      !("v" in parsed) ||
      parsed.v !== 1 ||
      !("day_tz" in parsed) ||
      !isSafeInteger(parsed.day_tz) ||
      !("offset" in parsed) ||
      !isSafeInteger(parsed.offset)
    ) {
      return null;
    }

    return parsed as StoredSleepTimeOffset;
  } catch {
    return null;
  }
}

function parseIsoDayStart(day: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const dayStart = Date.parse(`${day}T00:00:00Z`);
  if (
    !Number.isFinite(dayStart) ||
    new Date(dayStart).toISOString().slice(0, 10) !== day
  ) {
    return null;
  }

  return dayStart;
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}
