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
  let values: number[];
  try {
    values = JSON.parse(valuesJson);
  } catch {
    return 0;
  }
  const filtered = values.filter((v) => v > 0);
  if (filtered.length < 3) return 0;
  return coefficientOfVariation(filtered);
}

export function computeRollingCV(values: number[], windowSize: number): number {
  if (values.length < windowSize) return 0;
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
  return data.split("").map(classToNumeric).filter((v) => v >= 0);
}

export function computeIntradailyVariability(class5min: string): number {
  const values = parseClass5min(class5min);
  if (values.length < 3) return 0;

  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  for (let i = 1; i < n; i++) {
    numerator += (values[i] - values[i - 1]) ** 2;
  }
  numerator /= (n - 1);

  let denominator = 0;
  for (const v of values) {
    denominator += (v - mean) ** 2;
  }
  denominator /= n;

  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function computeRelativeAmplitude(class5min: string): number {
  const values = parseClass5min(class5min);
  if (values.length < 12) return 0;

  const hourBins: number[][] = [];
  const binSize = Math.floor(values.length / 24) || 1;

  for (let i = 0; i < values.length; i += binSize) {
    const bin = values.slice(i, i + binSize);
    hourBins.push(bin);
  }

  const binMeans = hourBins.map(
    (bin) => bin.reduce((s, v) => s + v, 0) / bin.length
  );

  const sorted = [...binMeans].sort((a, b) => a - b);
  const m10Count = Math.max(1, Math.ceil(sorted.length * 0.1));
  const l5Count = Math.max(1, Math.ceil(sorted.length * 0.05));

  const m10 = sorted.slice(-m10Count).reduce((s, v) => s + v, 0) / m10Count;
  const l5 = sorted.slice(0, l5Count).reduce((s, v) => s + v, 0) / l5Count;

  if (m10 + l5 === 0) return 0;
  return (m10 - l5) / (m10 + l5);
}

export function computeInterdailyStability(multiDayClass5min: string[]): number {
  if (multiDayClass5min.length < 3) return 0;

  const minLen = Math.min(...multiDayClass5min.map((d) => d.length));
  if (minLen < 12) return 0;

  const days = multiDayClass5min.map((d) => parseClass5min(d).slice(0, minLen));
  const n = days.length;
  const p = minLen;

  const grandMean =
    days.flat().reduce((s, v) => s + v, 0) / (n * p);

  let hourlyMeans: number[] = [];
  for (let h = 0; h < p; h++) {
    let sum = 0;
    for (let d = 0; d < n; d++) {
      sum += days[d][h];
    }
    hourlyMeans.push(sum / n);
  }

  let numerator = 0;
  for (const hm of hourlyMeans) {
    numerator += (hm - grandMean) ** 2;
  }
  numerator = (n * numerator) / p;

  let denominator = 0;
  for (const day of days) {
    for (const v of day) {
      denominator += (v - grandMean) ** 2;
    }
  }
  denominator /= (n * p);

  if (denominator === 0) return 0;
  return numerator / denominator;
}
