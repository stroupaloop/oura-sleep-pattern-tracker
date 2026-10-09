import { formatClockMinutes } from "./night-window";

/** The detector's stored view of one night: values, baselines and z-scores. */
export interface NightAnalysis {
  day: string;
  totalSleepMinutes: number | null;
  baselineSleepMinutes: number | null;
  sleepDurationZScore: number | null;
  bedtimeStartMinutes: number | null;
  baselineBedtimeMinutes: number | null;
  bedtimeZScore: number | null;
  wakeTimeMinutes: number | null;
  baselineWakeMinutes: number | null;
  wakeTimeZScore: number | null;
  onsetLatencyMinutes: number | null;
  baselineLatency: number | null;
  latencyZScore: number | null;
  avgHrv: number | null;
  baselineHrv: number | null;
  hrvZScore: number | null;
  avgHeartRate: number | null;
  baselineHeartRate: number | null;
  heartRateZScore: number | null;
  temperatureDeviation: number | null;
  baselineTemperature: number | null;
  temperatureZScore: number | null;
  efficiency: number | null;
  baselineEfficiency: number | null;
  efficiencyZScore: number | null;
}

export type SignalKey =
  | "sleep"
  | "bedtime"
  | "wake"
  | "latency"
  | "hrv"
  | "heartRate"
  | "temperature"
  | "efficiency";

/**
 * `usual` sits inside one standard deviation of her baseline, `outside` past
 * it, and `unusual` past the detector's own daily threshold.
 */
export type SignalLevel = "usual" | "outside" | "unusual" | "unknown";

export interface Signal {
  key: SignalKey;
  label: string;
  value: string;
  comparison: string;
  usualValue: string | null;
  z: number | null;
  level: SignalLevel;
}

/** Below this many standard deviations a night reads as "about usual". */
export const ABOUT_USUAL_Z = 0.5;

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/** "1h 5m", "48m", matching formatDuration across the app. */
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(Math.abs(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

/** "+0.3 °C", "−0.2 °C", and "0.0 °C" when it rounds to nothing. */
function formatCelsiusDeviation(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)} °C`;
}

function circularDelta(value: number, center: number): number {
  return ((((value - center + 720) % 1440) + 1440) % 1440) - 720;
}

export function levelFor(z: number | null, threshold: number): SignalLevel {
  if (!finite(z)) return "unknown";
  const size = Math.abs(z);
  if (size >= threshold) return "unusual";
  if (size >= 1) return "outside";
  return "usual";
}

interface SignalSpec {
  key: SignalKey;
  label: string;
  value: number | null;
  baseline: number | null;
  z: number | null;
  formatValue: (value: number) => string;
  formatUsual: (baseline: number) => string;
  /** The comparison once the night is clearly away from usual. */
  describe: (value: number, baseline: number) => string;
}

function buildSignal(spec: SignalSpec, threshold: number): Signal | null {
  if (!finite(spec.value)) return null;
  const hasBaseline = finite(spec.baseline) && finite(spec.z);
  const level = hasBaseline ? levelFor(spec.z, threshold) : "unknown";
  return {
    key: spec.key,
    label: spec.label,
    value: spec.formatValue(spec.value),
    comparison: !hasBaseline
      ? "Not enough nights for a baseline yet"
      : Math.abs(spec.z!) < ABOUT_USUAL_Z
        ? "About usual"
        : spec.describe(spec.value, spec.baseline!),
    usualValue: hasBaseline ? spec.formatUsual(spec.baseline!) : null,
    z: hasBaseline ? spec.z : null,
    level,
  };
}

function signedWord(
  delta: number,
  [positive, negative]: [string, string]
): string {
  return delta >= 0 ? positive : negative;
}

/**
 * The leading indicators for one night, in the order they tend to move ahead
 * of a mood shift: sleep amount and timing first, then the body.
 */
export function buildSignals(
  analysis: NightAnalysis | null,
  threshold: number
): Signal[] {
  if (!analysis) return [];
  const a = analysis;
  const specs: SignalSpec[] = [
    {
      key: "sleep",
      label: "Sleep",
      value: a.totalSleepMinutes,
      baseline: a.baselineSleepMinutes,
      z: a.sleepDurationZScore,
      formatValue: formatMinutes,
      formatUsual: (baseline) => formatMinutes(baseline),
      describe: (value, baseline) =>
        `${formatMinutes(value - baseline)} ${signedWord(value - baseline, [
          "more",
          "less",
        ])} than usual`,
    },
    {
      key: "bedtime",
      label: "Bedtime",
      value: a.bedtimeStartMinutes,
      baseline: a.baselineBedtimeMinutes,
      z: a.bedtimeZScore,
      formatValue: (value) => formatClockMinutes(value),
      formatUsual: (baseline) => formatClockMinutes(baseline),
      describe: (value, baseline) => {
        const delta = circularDelta(value, baseline);
        return `${formatMinutes(delta)} ${signedWord(delta, ["later", "earlier"])} than usual`;
      },
    },
    {
      key: "wake",
      label: "Wake",
      value: a.wakeTimeMinutes,
      baseline: a.baselineWakeMinutes,
      z: a.wakeTimeZScore,
      formatValue: (value) => formatClockMinutes(value),
      formatUsual: (baseline) => formatClockMinutes(baseline),
      describe: (value, baseline) => {
        const delta = circularDelta(value, baseline);
        return `${formatMinutes(delta)} ${signedWord(delta, ["later", "earlier"])} than usual`;
      },
    },
    {
      key: "latency",
      label: "Time to fall asleep",
      value: a.onsetLatencyMinutes,
      baseline: a.baselineLatency,
      z: a.latencyZScore,
      formatValue: formatMinutes,
      formatUsual: (baseline) => formatMinutes(baseline),
      describe: (value, baseline) =>
        `${formatMinutes(value - baseline)} ${signedWord(value - baseline, [
          "longer",
          "shorter",
        ])} than usual`,
    },
    {
      key: "hrv",
      label: "HRV",
      value: a.avgHrv,
      baseline: a.baselineHrv,
      z: a.hrvZScore,
      formatValue: (value) => `${Math.round(value)} ms`,
      formatUsual: (baseline) => `${Math.round(baseline)} ms`,
      describe: (value, baseline) =>
        `${Math.round(Math.abs(value - baseline))} ms ${signedWord(
          value - baseline,
          ["above", "below"]
        )} usual`,
    },
    {
      key: "heartRate",
      label: "Sleeping heart rate",
      value: a.avgHeartRate,
      baseline: a.baselineHeartRate,
      z: a.heartRateZScore,
      formatValue: (value) => `${Math.round(value)} bpm`,
      formatUsual: (baseline) => `${Math.round(baseline)} bpm`,
      describe: (value, baseline) =>
        `${Math.round(Math.abs(value - baseline))} bpm ${signedWord(
          value - baseline,
          ["above", "below"]
        )} usual`,
    },
    {
      key: "temperature",
      label: "Temperature",
      value: a.temperatureDeviation,
      baseline: a.baselineTemperature,
      z: a.temperatureZScore,
      formatValue: formatCelsiusDeviation,
      formatUsual: formatCelsiusDeviation,
      describe: (value, baseline) =>
        `${Math.abs(value - baseline).toFixed(1)} °C ${signedWord(
          value - baseline,
          ["warmer", "cooler"]
        )} than usual`,
    },
    {
      key: "efficiency",
      label: "Efficiency",
      value: a.efficiency,
      baseline: a.baselineEfficiency,
      z: a.efficiencyZScore,
      formatValue: (value) => `${Math.round(value)}%`,
      formatUsual: (baseline) => `${Math.round(baseline)}%`,
      describe: (value, baseline) => {
        const points = Math.round(Math.abs(value - baseline));
        return `${points} point${points === 1 ? "" : "s"} ${signedWord(
          value - baseline,
          ["above", "below"]
        )} usual`;
      },
    },
  ];

  return specs.flatMap((spec) => {
    const signal = buildSignal(spec, threshold);
    return signal ? [signal] : [];
  });
}
