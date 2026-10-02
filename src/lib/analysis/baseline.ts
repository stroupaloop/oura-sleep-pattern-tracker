export function trimmedMean(values: number[], trimPct = 0.1): number {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return Number.NaN;
  const sorted = [...finite].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * trimPct);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  if (trimmed.length === 0) return sorted[Math.floor(sorted.length / 2)];
  return trimmed.reduce((sum, v) => sum + v, 0) / trimmed.length;
}

export function standardDeviation(values: number[], mean: number): number {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2 || !Number.isFinite(mean)) return Number.NaN;
  const squaredDiffs = finite.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (finite.length - 1));
}

const NORMAL_IQR_IN_STANDARD_DEVIATIONS = 1.349;
const OUTLIER_CUTOFF_STANDARD_DEVIATIONS = 3;
const NORMAL_TRUNCATED_AT_CUTOFF_CORRECTION = 1.0136;

function quantileSorted(sorted: number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (position - lower) * (sorted[upper] - sorted[lower]);
}

function rootMeanSquare(deviations: number[]): number {
  return Math.sqrt(
    deviations.reduce((sum, deviation) => sum + deviation ** 2, 0) /
      (deviations.length - 1)
  );
}

// A far-off night (a recovery sleep, a 4am bedtime) would widen the whole
// baseline and hide the next unusual night, so nights over three robust SDs
// (IQR / 1.349) from the center are left out of the spread. Quartiles keep
// their scale on integer metrics with many ties, where a MAD around a trimmed
// mean collapses toward zero. The correction undoes the cut's bias.
function inlierStandardDeviation(deviations: number[]): number {
  if (deviations.length < 2) return Number.NaN;
  const sorted = [...deviations].sort((a, b) => a - b);
  const robustScale =
    (quantileSorted(sorted, 0.75) - quantileSorted(sorted, 0.25)) /
    NORMAL_IQR_IN_STANDARD_DEVIATIONS;
  const inliers = deviations.filter(
    (deviation) =>
      Math.abs(deviation) <= OUTLIER_CUTOFF_STANDARD_DEVIATIONS * robustScale
  );
  if (robustScale === 0 || inliers.length < 2) return rootMeanSquare(deviations);
  return rootMeanSquare(inliers) * NORMAL_TRUNCATED_AT_CUTOFF_CORRECTION;
}

export function robustStandardDeviation(values: number[], center: number): number {
  if (!Number.isFinite(center)) return Number.NaN;
  return inlierStandardDeviation(
    values.filter(Number.isFinite).map((value) => value - center)
  );
}

export function zScore(value: number, mean: number, std: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(mean) || !Number.isFinite(std) || std === 0) {
    return 0;
  }
  return (value - mean) / std;
}

export function coefficientOfVariation(values: number[]): number {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return Number.NaN;
  const mean = finite.reduce((s, v) => s + v, 0) / finite.length;
  if (Math.abs(mean) < 0.001) return 0;
  const std = standardDeviation(finite, mean);
  return std / Math.abs(mean);
}

export function minutesFromMidnight(isoDatetime: string): number {
  const wallTime = isoDatetime.match(/T(\d{2}):(\d{2})/);
  if (!wallTime) return Number.NaN;
  const hour = Number.parseInt(wallTime[1], 10);
  const minute = Number.parseInt(wallTime[2], 10);
  let minutes = hour * 60 + minute;
  if (minutes > 720) minutes -= 1440;
  return minutes;
}

export function circularMeanMinutes(values: number[]): number {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return Number.NaN;

  const angles = finite.map((value) => ((value % 1440 + 1440) % 1440) * Math.PI / 720);
  const sinMean = angles.reduce((sum, angle) => sum + Math.sin(angle), 0) / angles.length;
  const cosMean = angles.reduce((sum, angle) => sum + Math.cos(angle), 0) / angles.length;
  if (Math.abs(sinMean) < Number.EPSILON && Math.abs(cosMean) < Number.EPSILON) {
    return Number.NaN;
  }

  const positiveMinutes = ((Math.atan2(sinMean, cosMean) * 720) / Math.PI + 1440) % 1440;
  return positiveMinutes > 720 ? positiveMinutes - 1440 : positiveMinutes;
}

export function circularDifferenceMinutes(value: number, center: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(center)) return Number.NaN;
  return ((value - center + 720) % 1440 + 1440) % 1440 - 720;
}

export function robustCircularStandardDeviationMinutes(
  values: number[],
  center = circularMeanMinutes(values)
): number {
  if (!Number.isFinite(center)) return Number.NaN;
  return inlierStandardDeviation(
    values
      .map((value) => circularDifferenceMinutes(value, center))
      .filter(Number.isFinite)
  );
}

export function circularVariation(values: number[]): number {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return Number.NaN;

  const angles = finite.map((value) => ((value % 1440 + 1440) % 1440) * Math.PI / 720);
  const sinMean = angles.reduce((sum, angle) => sum + Math.sin(angle), 0) / angles.length;
  const cosMean = angles.reduce((sum, angle) => sum + Math.cos(angle), 0) / angles.length;
  const resultantLength = Math.sqrt(sinMean ** 2 + cosMean ** 2);
  return 1 - Math.min(1, resultantLength);
}

export function circularZScore(
  value: number,
  center: number,
  standardDeviationMinutes: number
): number {
  const difference = circularDifferenceMinutes(value, center);
  if (!Number.isFinite(difference) || !Number.isFinite(standardDeviationMinutes) || standardDeviationMinutes === 0) {
    return 0;
  }
  return difference / standardDeviationMinutes;
}

export function isNextCalendarDay(previousDay: string, nextDay: string): boolean {
  const previous = Date.parse(`${previousDay}T00:00:00Z`);
  const next = Date.parse(`${nextDay}T00:00:00Z`);
  return Number.isFinite(previous) && Number.isFinite(next) && next - previous === 86_400_000;
}
