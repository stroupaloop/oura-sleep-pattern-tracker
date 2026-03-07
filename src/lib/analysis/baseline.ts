export function trimmedMean(values: number[], trimPct = 0.1): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trimPct);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
  return trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;
}

export function standardDeviation(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

export function zScore(value: number, mean: number, std: number): number {
  if (std === 0) return 0;
  return (value - mean) / std;
}

export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (Math.abs(mean) < 0.001) return 0;
  const std = standardDeviation(values, mean);
  return std / Math.abs(mean);
}

export function minutesFromMidnight(isoDatetime: string): number {
  const d = new Date(isoDatetime);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  let minutes = hour * 60 + minute;
  if (minutes > 720) minutes -= 1440;
  return minutes;
}
