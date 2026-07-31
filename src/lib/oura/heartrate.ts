import type { OuraHeartrateSample } from "./types";
import { APP_TIME_ZONE } from "@/lib/date-utils";

export const DEFAULT_OURA_TIME_ZONE = APP_TIME_ZONE;

export interface DailyHeartRateBucket {
  day: string;
  avgBpm: number;
  minBpm: number;
  maxBpm: number;
  restingBpm: number | null;
  awakeBpm: number | null;
  sampleCount: number;
}

export interface HourlyHeartRateBucket {
  day: string;
  hour: number;
  avgBpm: number;
  minBpm: number;
  maxBpm: number;
  sampleCount: number;
  source: string;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function localDayHour(
  timestamp: string,
  timeZone: string
): { day: string; hour: number } {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid Oura heart-rate timestamp");
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  const hour = Number(value("hour"));

  if (!year || !month || !day || !Number.isInteger(hour)) {
    throw new TypeError("Unable to bucket Oura heart-rate timestamp");
  }

  return { day: `${year}-${month}-${day}`, hour };
}

function shiftIsoDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid Oura heart-rate date");
  }
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function zonedMidnightToUtc(day: string, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(date)
  ) {
    throw new TypeError("Invalid Oura heart-rate date");
  }

  const desiredUtc = Date.UTC(year, month - 1, date);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const offsetAt = (instant: Date) => {
    const parts = formatter.formatToParts(instant);
    const number = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    return (
      Date.UTC(
        number("year"),
        number("month") - 1,
        number("day"),
        number("hour"),
        number("minute"),
        number("second")
      ) - instant.getTime()
    );
  };

  const firstGuess = new Date(desiredUtc);
  const firstOffset = offsetAt(firstGuess);
  const adjusted = new Date(desiredUtc - firstOffset);
  const adjustedOffset = offsetAt(adjusted);
  return new Date(desiredUtc - adjustedOffset);
}

function dominantSource(samples: OuraHeartrateSample[]): string {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    counts.set(sample.source, (counts.get(sample.source) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0 || ranked[0][1] === ranked[1]?.[1]) return "mixed";
  return ranked[0][0];
}

export function getOuraTimeZone(): string {
  return DEFAULT_OURA_TIME_ZONE;
}

export function getHeartRateQueryRange(
  startDay: string,
  endDay: string,
  timeZone = getOuraTimeZone()
): { startDatetime: string; endDatetime: string } {
  const start = zonedMidnightToUtc(startDay, timeZone);
  const endExclusive = zonedMidnightToUtc(shiftIsoDay(endDay, 1), timeZone);
  return {
    startDatetime: start.toISOString(),
    endDatetime: new Date(endExclusive.getTime() - 1000).toISOString(),
  };
}

export function aggregateHeartRateSamples(
  samples: OuraHeartrateSample[],
  timeZone = getOuraTimeZone()
): {
  daily: DailyHeartRateBucket[];
  hourly: HourlyHeartRateBucket[];
} {
  const byDay = new Map<string, OuraHeartrateSample[]>();
  const byDayHour = new Map<string, OuraHeartrateSample[]>();

  for (const sample of samples) {
    if (!Number.isFinite(sample.bpm) || sample.bpm <= 0) {
      throw new TypeError("Invalid Oura heart-rate value");
    }
    const bucket = localDayHour(sample.timestamp, timeZone);
    const daySamples = byDay.get(bucket.day) ?? [];
    daySamples.push(sample);
    byDay.set(bucket.day, daySamples);

    const key = `${bucket.day}|${bucket.hour}`;
    const hourSamples = byDayHour.get(key) ?? [];
    hourSamples.push(sample);
    byDayHour.set(key, hourSamples);
  }

  const daily = [...byDay.entries()].map(([day, daySamples]) => {
    const bpms = daySamples.map((sample) => sample.bpm);
    const restBpms = daySamples
      .filter((sample) => sample.source === "rest")
      .map((sample) => sample.bpm);
    const awakeBpms = daySamples
      .filter((sample) => sample.source === "awake")
      .map((sample) => sample.bpm);
    return {
      day,
      avgBpm: roundTenth(average(bpms)),
      minBpm: Math.min(...bpms),
      maxBpm: Math.max(...bpms),
      restingBpm: restBpms.length > 0 ? roundTenth(average(restBpms)) : null,
      awakeBpm:
        awakeBpms.length > 0 ? roundTenth(average(awakeBpms)) : null,
      sampleCount: daySamples.length,
    };
  });

  const hourly = [...byDayHour.entries()].map(([key, hourSamples]) => {
    const [day, hour] = key.split("|");
    const bpms = hourSamples.map((sample) => sample.bpm);
    return {
      day,
      hour: Number(hour),
      avgBpm: roundTenth(average(bpms)),
      minBpm: Math.min(...bpms),
      maxBpm: Math.max(...bpms),
      sampleCount: hourSamples.length,
      source: dominantSource(hourSamples),
    };
  });

  return { daily, hourly };
}
