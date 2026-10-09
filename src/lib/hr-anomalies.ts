import { shiftIsoDay } from "@/lib/date-utils";

export interface HourlyHrPoint {
  day: string;
  hour: number;
  avgBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
  source: string | null;
}

export interface HrAnomaly {
  day: string;
  hour: number;
  type: "spike" | "drop" | "elevated_resting";
  severity: "moderate" | "high";
  message: string;
  bpm: number;
  baseline: number;
}

/**
 * Each hour is compared with the same hour over the two weeks before its
 * day, however much history the page loaded.
 */
export const HR_ANOMALY_BASELINE_DAYS = 14;

/** An hour with fewer same-hour days than this has no baseline and is not judged. */
export const HR_ANOMALY_MIN_BASELINE_DAYS = 7;

/**
 * How far an overnight hour sits from her same-hour average, in standard
 * deviations, before it counts as unusual. The chart's explanation of its
 * amber markers reads this same number.
 */
export const HR_ANOMALY_Z_THRESHOLD = 2.5;

/** Hourly means wobble by a couple of bpm on their own, so spread never counts as less. */
export const HR_ANOMALY_MIN_SD_BPM = 2;

/** One odd hour is chance; a marker needs this many in a row, in one direction. */
export const HR_ANOMALY_MIN_RUN_HOURS = 2;

/**
 * The local hours that are judged, the core of a night's sleep. Daytime
 * hours swing with whatever she was doing, so they are not.
 */
export const HR_ANOMALY_NIGHT_FIRST_HOUR = 0;
export const HR_ANOMALY_NIGHT_LAST_HOUR = 6;

/**
 * An elevated-resting marker needs this many adjacent rest hours in a row,
 * each above her same-hour average by more than `HR_ELEVATED_RESTING_Z`
 * standard deviations.
 */
export const HR_ELEVATED_RESTING_HOURS = 3;
export const HR_ELEVATED_RESTING_Z = 1;

const HIGH_SEVERITY_Z = 3;

interface HourStats {
  mean: number;
  sd: number;
  days: number;
}

function baselinePoints(
  day: string,
  allHourlyData: HourlyHrPoint[]
): HourlyHrPoint[] {
  const start = shiftIsoDay(day, -HR_ANOMALY_BASELINE_DAYS) ?? day;
  return allHourlyData.filter((point) => point.day >= start && point.day < day);
}

function buildHourlyStats(points: HourlyHrPoint[]): Map<number, HourStats> {
  const baselineByHour = new Map<number, number[]>();
  for (const point of points) {
    if (point.avgBpm == null) continue;
    const values = baselineByHour.get(point.hour);
    if (values) values.push(point.avgBpm);
    else baselineByHour.set(point.hour, [point.avgBpm]);
  }

  const stats = new Map<number, HourStats>();
  for (const [hour, values] of baselineByHour) {
    if (values.length < HR_ANOMALY_MIN_BASELINE_DAYS) continue;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      (values.length - 1);
    stats.set(hour, {
      mean,
      sd: Math.max(Math.sqrt(variance), HR_ANOMALY_MIN_SD_BPM),
      days: values.length,
    });
  }

  return stats;
}

/**
 * Standard deviations from the same-hour average. The baseline is itself
 * only a sample of a few days, so a new hour is judged against a spread a
 * little wider than the baseline's own.
 */
function predictiveZ(bpm: number, baseline: HourStats): number {
  return (
    (bpm - baseline.mean) / (baseline.sd * Math.sqrt(1 + 1 / baseline.days))
  );
}

export function areAdjacentLocalHours(
  previous: Pick<HourlyHrPoint, "day" | "hour">,
  current: Pick<HourlyHrPoint, "day" | "hour">
): boolean {
  if (previous.day === current.day) {
    return current.hour === previous.hour + 1;
  }

  return (
    previous.hour === 23 &&
    current.hour === 0 &&
    shiftIsoDay(previous.day, 1) === current.day
  );
}

interface UnusualHour {
  day: string;
  hour: number;
  bpm: number;
  z: number;
  baseline: number;
}

function detectUnusualNightRuns(
  todayData: HourlyHrPoint[],
  stats: Map<number, HourStats>
): HrAnomaly[] {
  const unusual: UnusualHour[] = [];
  const nightHours = todayData
    .filter(
      (point) =>
        point.hour >= HR_ANOMALY_NIGHT_FIRST_HOUR &&
        point.hour <= HR_ANOMALY_NIGHT_LAST_HOUR
    )
    .sort((a, b) => a.hour - b.hour);

  for (const point of nightHours) {
    if (point.avgBpm == null) continue;
    const baseline = stats.get(point.hour);
    if (!baseline) continue;
    const z = predictiveZ(point.avgBpm, baseline);
    if (Math.abs(z) > HR_ANOMALY_Z_THRESHOLD) {
      unusual.push({
        day: point.day,
        hour: point.hour,
        bpm: point.avgBpm,
        z,
        baseline: baseline.mean,
      });
    }
  }

  const anomalies: HrAnomaly[] = [];
  let run: UnusualHour[] = [];
  const closeRun = () => {
    if (run.length >= HR_ANOMALY_MIN_RUN_HOURS) {
      for (const hour of run) {
        const type = hour.z > 0 ? "spike" : "drop";
        anomalies.push({
          day: hour.day,
          hour: hour.hour,
          type,
          severity: Math.abs(hour.z) > HIGH_SEVERITY_Z ? "high" : "moderate",
          message: `HR ${type}: ${Math.round(hour.bpm)} bpm (baseline ~${Math.round(hour.baseline)})`,
          bpm: hour.bpm,
          baseline: hour.baseline,
        });
      }
    }
    run = [];
  };

  for (const hour of unusual) {
    const previous = run[run.length - 1];
    if (
      previous &&
      (Math.sign(previous.z) !== Math.sign(hour.z) ||
        !areAdjacentLocalHours(previous, hour))
    ) {
      closeRun();
    }
    run.push(hour);
  }
  closeRun();

  return anomalies;
}

export function detectHrAnomalies(
  selectedDay: string,
  allHourlyData: HourlyHrPoint[]
): HrAnomaly[] {
  const todayData = allHourlyData.filter((d) => d.day === selectedDay);
  const priorData = baselinePoints(selectedDay, allHourlyData);

  if (todayData.length === 0) return [];

  const stats = buildHourlyStats(priorData);

  const anomalies = detectUnusualNightRuns(todayData, stats);

  const previousDay = shiftIsoDay(selectedDay, -1);
  const restHours = allHourlyData
    .filter((p) => p.source === "rest" && p.avgBpm != null)
    .filter((p) => p.day === selectedDay || p.day === previousDay)
    .sort((a, b) => a.day.localeCompare(b.day) || a.hour - b.hour);

  let consecutive = 0;
  let previousElevatedPoint: HourlyHrPoint | null = null;
  const streakStatsByDay = new Map<string, ReturnType<typeof buildHourlyStats>>();

  for (const point of restHours) {
    let dayStats = streakStatsByDay.get(point.day);
    if (!dayStats) {
      dayStats = buildHourlyStats(baselinePoints(point.day, allHourlyData));
      streakStatsByDay.set(point.day, dayStats);
    }

    const baseline = dayStats.get(point.hour);
    if (!baseline || point.avgBpm == null) {
      consecutive = 0;
      previousElevatedPoint = null;
      continue;
    }

    if (point.avgBpm > baseline.mean + HR_ELEVATED_RESTING_Z * baseline.sd) {
      consecutive =
        previousElevatedPoint &&
        areAdjacentLocalHours(previousElevatedPoint, point)
          ? consecutive + 1
          : 1;
      previousElevatedPoint = point;

      if (
        consecutive >= HR_ELEVATED_RESTING_HOURS &&
        point.day === selectedDay
      ) {
        anomalies.push({
          day: point.day,
          hour: point.hour,
          type: "elevated_resting",
          severity: "moderate",
          message: `Elevated resting HR for ${consecutive}+ hours`,
          bpm: point.avgBpm,
          baseline: baseline.mean,
        });
        break;
      }
    } else {
      consecutive = 0;
      previousElevatedPoint = null;
    }
  }

  return anomalies;
}
