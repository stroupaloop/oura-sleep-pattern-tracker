import { coefficientOfVariation } from "./baseline";

export type SleepStage = 1 | 2 | 3 | 4;

export function parseHypnogram5min(data: string): SleepStage[] {
  return data.split("").map((c) => parseInt(c, 10) as SleepStage).filter((v) => v >= 1 && v <= 4);
}

export function computeSleepStageTransitions(stages: SleepStage[]): number {
  if (stages.length < 2) return 0;
  let transitions = 0;
  for (let i = 1; i < stages.length; i++) {
    if (stages[i] !== stages[i - 1]) transitions++;
  }
  return transitions;
}

export function computeHypnogramFragmentation(stages: SleepStage[]): number {
  if (stages.length < 2) return 0;
  const transitions = computeSleepStageTransitions(stages);
  return transitions / (stages.length - 1);
}

export function computeWithinNightCV(valuesJson: string): number {
  let values: unknown[];
  try {
    const parsed: unknown = JSON.parse(valuesJson);
    values = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed !== null &&
          Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : [];
  } catch {
    return Number.NaN;
  }
  const filtered = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value) && value > 0
  );
  if (filtered.length < 3) return Number.NaN;
  return coefficientOfVariation(filtered);
}

export function computeRollingCV(values: number[], windowSize: number): number {
  if (values.length < windowSize) return Number.NaN;
  const window = values.slice(-windowSize);
  return coefficientOfVariation(window);
}

function classToNumeric(classChar: string): number {
  switch (classChar) {
    case "0": return 0;
    case "1": return 1;
    case "2": return 2;
    case "3": return 3;
    case "4": return 4;
    case "5": return 5;
    default: return -1;
  }
}

function parseClass5min(data: string): number[] {
  return data.split("").map((value) => {
    const parsed = classToNumeric(value);
    return parsed > 0 ? parsed : Number.NaN;
  });
}

export function computeIntradailyVariability(class5min: string): number {
  const values = parseClass5min(class5min);
  const finiteValues = values.filter(Number.isFinite);
  if (values.length < 3 || finiteValues.length / values.length < 0.8) {
    return Number.NaN;
  }

  const mean = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;

  let numerator = 0;
  let adjacentPairs = 0;
  for (let i = 1; i < values.length; i++) {
    if (Number.isFinite(values[i]) && Number.isFinite(values[i - 1])) {
      numerator += (values[i] - values[i - 1]) ** 2;
      adjacentPairs++;
    }
  }
  if (adjacentPairs < 2) return Number.NaN;

  const denominator = finiteValues.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0
  );

  if (denominator === 0) return 0;
  return (finiteValues.length * numerator) / (adjacentPairs * denominator);
}

export function computeRelativeAmplitude(class5min: string): number {
  const values = parseClass5min(class5min);
  const finiteCount = values.filter(Number.isFinite).length;
  if (values.length < 24 || finiteCount / values.length < 0.8) {
    return Number.NaN;
  }

  const m10Size = Math.max(1, Math.round((values.length * 10) / 24));
  const l5Size = Math.max(1, Math.round((values.length * 5) / 24));

  const circularWindowMeans = (windowSize: number): number[] => {
    const means: number[] = [];
    for (let start = 0; start < values.length; start++) {
      const window: number[] = [];
      for (let offset = 0; offset < windowSize; offset++) {
        window.push(values[(start + offset) % values.length]);
      }
      const finite = window.filter(Number.isFinite);
      if (finite.length / windowSize >= 0.8) {
        means.push(finite.reduce((sum, value) => sum + value, 0) / finite.length);
      }
    }
    return means;
  };

  const m10Means = circularWindowMeans(m10Size);
  const l5Means = circularWindowMeans(l5Size);
  if (m10Means.length === 0 || l5Means.length === 0) return Number.NaN;

  const m10 = Math.max(...m10Means);
  const l5 = Math.min(...l5Means);

  if (m10 + l5 === 0) return 0;
  return (m10 - l5) / (m10 + l5);
}

export function computeInterdailyStability(multiDayClass5min: string[]): number {
  if (multiDayClass5min.length < 3) return Number.NaN;

  const minLen = Math.min(...multiDayClass5min.map((d) => d.length));
  if (minLen < 12) return Number.NaN;

  const days = multiDayClass5min.map((d) => parseClass5min(d).slice(0, minLen));
  if (days.some((day) => day.filter(Number.isFinite).length / minLen < 0.8)) {
    return Number.NaN;
  }

  const allValues = days.flat().filter(Number.isFinite);
  const grandMean = allValues.reduce((sum, value) => sum + value, 0) / allValues.length;

  const timeOfDayMeans: number[] = [];
  for (let sample = 0; sample < minLen; sample++) {
    const sameTimeValues = days
      .map((day) => day[sample])
      .filter(Number.isFinite);
    if (sameTimeValues.length >= 2) {
      timeOfDayMeans.push(
        sameTimeValues.reduce((sum, value) => sum + value, 0) /
          sameTimeValues.length
      );
    }
  }

  if (timeOfDayMeans.length < minLen * 0.8) return Number.NaN;

  const numerator =
    days.length *
    timeOfDayMeans.reduce(
      (sum, timeOfDayMean) => sum + (timeOfDayMean - grandMean) ** 2,
      0
    );
  const denominator = allValues.reduce(
    (sum, value) => sum + (value - grandMean) ** 2,
    0
  );

  if (denominator === 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}
