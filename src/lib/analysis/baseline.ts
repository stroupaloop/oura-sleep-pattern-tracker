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

export function minutesFromMidnight(isoDatetime: string): number {
  const d = new Date(isoDatetime);
  let minutes = d.getHours() * 60 + d.getMinutes();
  // If after noon, treat as negative (e.g., 11 PM = -60 minutes before midnight)
  // If before noon, treat as positive (e.g., 1 AM = 60 minutes after midnight)
  if (minutes > 720) minutes -= 1440;
  return minutes;
}
