export const OURA_ACTIVITY_INTERVAL_MINUTES = 5;

export type OuraActivityCode = 0 | 1 | 2 | 3 | 4 | 5;

export interface StoredOuraActivityClassification {
  day: string;
  class5min: string | null;
  met: string | null;
}

export interface ProjectedActivityHour {
  hour: number;
  dominantCode: OuraActivityCode | null;
  classifiedMinutes: number;
  nonWearMinutes: number;
}

export interface ProjectedActivityDay {
  day: string;
  hours: ProjectedActivityHour[];
  classifiedMinutes: number;
  nonWearMinutes: number;
  restingMinutes: number;
  inactiveMinutes: number;
  lowActivityMinutes: number;
  mediumActivityMinutes: number;
  highActivityMinutes: number;
}

interface ParsedActivityRecord {
  day: string;
  start: number;
  codes: OuraActivityCode[];
}

interface InstantClassification {
  code: OuraActivityCode;
  sourceStart: number;
  sourceDay: string;
}

interface ActivityHourAccumulator {
  counts: [number, number, number, number, number, number];
}

function parseActivityStart(met: string | null): number | null {
  if (!met) return null;

  try {
    const parsed: unknown = JSON.parse(met);
    if (
      typeof parsed !== "object" ||
      parsed === null
    ) {
      return null;
    }

    const values = parsed as {
      activity_timestamp?: unknown;
      timestamp?: unknown;
    };
    for (const timestamp of [
      values.activity_timestamp,
      values.timestamp,
    ]) {
      if (
        typeof timestamp !== "string" ||
        !/(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp)
      ) {
        continue;
      }
      const start = Date.parse(timestamp);
      if (Number.isFinite(start)) return start;
    }
    return null;
  } catch {
    return null;
  }
}

function parseActivityCodes(value: string | null): OuraActivityCode[] | null {
  if (!value || !/^[0-5]+$/.test(value)) return null;
  return Array.from(value, (character) =>
    Number(character)
  ) as OuraActivityCode[];
}

function parseActivityRecord(
  record: StoredOuraActivityClassification
): ParsedActivityRecord | null {
  const start = parseActivityStart(record.met);
  const codes = parseActivityCodes(record.class5min);
  if (start == null || codes == null) return null;
  return { day: record.day, start, codes };
}

function localDayHour(
  instant: number,
  formatter: Intl.DateTimeFormat
): { day: string; hour: number } | null {
  const parts = formatter.formatToParts(new Date(instant));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = Number(value("hour"));

  if (
    !year ||
    !month ||
    !day ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    return null;
  }

  return { day: `${year}-${month}-${day}`, hour };
}

function dominantActivityCode(
  counts: ActivityHourAccumulator["counts"]
): OuraActivityCode | null {
  const totalIntervals = counts.reduce((sum, count) => sum + count, 0);
  if (totalIntervals === 0) return null;

  const largestCount = Math.max(...counts);
  const leaders = counts
    .map((count, code) => ({ count, code: code as OuraActivityCode }))
    .filter(({ count }) => count === largestCount);

  if (leaders.length !== 1) return null;

  const leader = leaders[0].code;
  if (
    leader === 0 &&
    (counts[0] <= totalIntervals / 2 ||
      counts[0] * OURA_ACTIVITY_INTERVAL_MINUTES <= 30)
  ) {
    return null;
  }

  return leader;
}

export function projectActivityToCalendarDays(
  records: StoredOuraActivityClassification[],
  timeZone: string
): ProjectedActivityDay[] {
  const parsedRecords = records
    .map(parseActivityRecord)
    .filter((record): record is ParsedActivityRecord => record != null)
    .sort(
      (left, right) =>
        left.start - right.start || left.day.localeCompare(right.day)
    );

  const byInstant = new Map<number, InstantClassification>();
  const intervalMs = OURA_ACTIVITY_INTERVAL_MINUTES * 60 * 1000;

  for (const record of parsedRecords) {
    for (let index = 0; index < record.codes.length; index++) {
      const instant = record.start + index * intervalMs;
      const existing = byInstant.get(instant);
      if (
        !existing ||
        record.start > existing.sourceStart ||
        (record.start === existing.sourceStart &&
          record.day >= existing.sourceDay)
      ) {
        byInstant.set(instant, {
          code: record.codes[index],
          sourceStart: record.start,
          sourceDay: record.day,
        });
      }
    }
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });
  const byDayHour = new Map<string, ActivityHourAccumulator>();

  for (const [instant, classification] of byInstant) {
    const bucket = localDayHour(instant, formatter);
    if (!bucket) continue;

    const key = `${bucket.day}|${bucket.hour}`;
    const accumulator = byDayHour.get(key) ?? {
      counts: [0, 0, 0, 0, 0, 0],
    };
    accumulator.counts[classification.code]++;
    byDayHour.set(key, accumulator);
  }

  const dayKeys = new Set(
    [...byDayHour.keys()].map((key) => key.slice(0, key.lastIndexOf("|")))
  );

  return [...dayKeys]
    .sort()
    .map((day): ProjectedActivityDay => {
      const totals: [number, number, number, number, number, number] = [
        0, 0, 0, 0, 0, 0,
      ];
      const hours = Array.from({ length: 24 }, (_, hour) => {
        const counts =
          byDayHour.get(`${day}|${hour}`)?.counts ??
          ([0, 0, 0, 0, 0, 0] as ActivityHourAccumulator["counts"]);
        counts.forEach((count, code) => {
          totals[code] += count;
        });

        return {
          hour,
          dominantCode: dominantActivityCode(counts),
          classifiedMinutes:
            counts.reduce((sum, count) => sum + count, 0) *
            OURA_ACTIVITY_INTERVAL_MINUTES,
          nonWearMinutes: counts[0] * OURA_ACTIVITY_INTERVAL_MINUTES,
        };
      });
      const minutes = (code: OuraActivityCode) =>
        totals[code] * OURA_ACTIVITY_INTERVAL_MINUTES;

      return {
        day,
        hours,
        classifiedMinutes:
          totals.reduce((sum, count) => sum + count, 0) *
          OURA_ACTIVITY_INTERVAL_MINUTES,
        nonWearMinutes: minutes(0),
        restingMinutes: minutes(1),
        inactiveMinutes: minutes(2),
        lowActivityMinutes: minutes(3),
        mediumActivityMinutes: minutes(4),
        highActivityMinutes: minutes(5),
      };
    });
}
