export interface HourlyHrPoint {
  day: string;
  hour: number;
  avgBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
  source: string | null;
}

export interface HrAnomaly {
  hour: number;
  type: "spike" | "drop" | "elevated_resting";
  severity: "moderate" | "high";
  message: string;
  bpm: number;
  baseline: number;
}

export function detectHrAnomalies(
  selectedDay: string,
  allHourlyData: HourlyHrPoint[]
): HrAnomaly[] {
  const todayData = allHourlyData.filter((d) => d.day === selectedDay);
  const priorData = allHourlyData.filter((d) => d.day < selectedDay);

  if (todayData.length === 0) return [];

  const baselineByHour = new Map<number, number[]>();
  for (const d of priorData) {
    if (d.avgBpm == null) continue;
    const arr = baselineByHour.get(d.hour);
    if (arr) arr.push(d.avgBpm);
    else baselineByHour.set(d.hour, [d.avgBpm]);
  }

  const stats = new Map<number, { mean: number; sd: number }>();
  for (const [hour, vals] of baselineByHour) {
    if (vals.length < 3) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const sd = Math.sqrt(variance);
    stats.set(hour, { mean, sd: sd > 0 ? sd : 1 });
  }

  const anomalies: HrAnomaly[] = [];

  for (const point of todayData) {
    if (point.avgBpm == null) continue;
    const baseline = stats.get(point.hour);
    if (!baseline) continue;

    const zScore = (point.avgBpm - baseline.mean) / baseline.sd;

    if (zScore > 2) {
      anomalies.push({
        hour: point.hour,
        type: "spike",
        severity: zScore > 3 ? "high" : "moderate",
        message: `HR spike: ${Math.round(point.avgBpm)} bpm (baseline ~${Math.round(baseline.mean)})`,
        bpm: point.avgBpm,
        baseline: baseline.mean,
      });
    } else if (zScore < -2) {
      anomalies.push({
        hour: point.hour,
        type: "drop",
        severity: zScore < -3 ? "high" : "moderate",
        message: `HR drop: ${Math.round(point.avgBpm)} bpm (baseline ~${Math.round(baseline.mean)})`,
        bpm: point.avgBpm,
        baseline: baseline.mean,
      });
    }
  }

  const restHours = todayData
    .filter((p) => p.source === "rest" && p.avgBpm != null)
    .sort((a, b) => a.hour - b.hour);

  let consecutive = 0;
  for (const point of restHours) {
    const baseline = stats.get(point.hour);
    if (!baseline || point.avgBpm == null) {
      consecutive = 0;
      continue;
    }
    if (point.avgBpm > baseline.mean + baseline.sd) {
      consecutive++;
      if (consecutive >= 3) {
        anomalies.push({
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
    }
  }

  return anomalies;
}
