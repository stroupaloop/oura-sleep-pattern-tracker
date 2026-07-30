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

function buildHourlyStats(points: HourlyHrPoint[]) {
  const baselineByHour = new Map<number, number[]>();
  for (const point of points) {
    if (point.avgBpm == null) continue;
    const values = baselineByHour.get(point.hour);
    if (values) values.push(point.avgBpm);
    else baselineByHour.set(point.hour, [point.avgBpm]);
  }

  const stats = new Map<number, { mean: number; sd: number }>();
  for (const [hour, values] of baselineByHour) {
    if (values.length < 3) continue;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      values.length;
    const sd = Math.sqrt(variance);
    stats.set(hour, { mean, sd: sd > 0 ? sd : 1 });
  }

  return stats;
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

export function detectHrAnomalies(
  selectedDay: string,
  allHourlyData: HourlyHrPoint[]
): HrAnomaly[] {
  const todayData = allHourlyData.filter((d) => d.day === selectedDay);
  const priorData = allHourlyData.filter((d) => d.day < selectedDay);

  if (todayData.length === 0) return [];

  const stats = buildHourlyStats(priorData);

  const anomalies: HrAnomaly[] = [];

  for (const point of todayData) {
    if (point.avgBpm == null) continue;
    const baseline = stats.get(point.hour);
    if (!baseline) continue;

    const zScore = (point.avgBpm - baseline.mean) / baseline.sd;

    if (zScore > 2) {
      anomalies.push({
        day: point.day,
        hour: point.hour,
        type: "spike",
        severity: zScore > 3 ? "high" : "moderate",
        message: `HR spike: ${Math.round(point.avgBpm)} bpm (baseline ~${Math.round(baseline.mean)})`,
        bpm: point.avgBpm,
        baseline: baseline.mean,
      });
    } else if (zScore < -2) {
      anomalies.push({
        day: point.day,
        hour: point.hour,
        type: "drop",
        severity: zScore < -3 ? "high" : "moderate",
        message: `HR drop: ${Math.round(point.avgBpm)} bpm (baseline ~${Math.round(baseline.mean)})`,
        bpm: point.avgBpm,
        baseline: baseline.mean,
      });
    }
  }

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
      dayStats = buildHourlyStats(
        allHourlyData.filter((candidate) => candidate.day < point.day)
      );
      streakStatsByDay.set(point.day, dayStats);
    }

    const baseline = dayStats.get(point.hour);
    if (!baseline || point.avgBpm == null) {
      consecutive = 0;
      previousElevatedPoint = null;
      continue;
    }

    if (point.avgBpm > baseline.mean + baseline.sd) {
      consecutive =
        previousElevatedPoint &&
        areAdjacentLocalHours(previousElevatedPoint, point)
          ? consecutive + 1
          : 1;
      previousElevatedPoint = point;

      if (consecutive >= 3 && point.day === selectedDay) {
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
