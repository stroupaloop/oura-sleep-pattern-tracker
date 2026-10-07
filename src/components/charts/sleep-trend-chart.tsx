"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  Legend,
  ComposedChart,
} from "recharts";
import {
  GapNote,
  type GapRow,
  NoNightTooltip,
  hasValues,
  isolatedDot,
} from "./chart-gaps";
import { CHART, legendLabel } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";
import { formatNightLabel } from "@/lib/health/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computeCalendarRollingAverage } from "@/lib/dashboard-metrics";


interface SleepData extends GapRow {
  day: string;
  hours: number | null;
  deep: number | null;
  rem: number | null;
  light: number | null;
  efficiency: number | null;
  hrv: number | null;
  hr: number | null;
}

interface AnalysisPoint {
  day: string;
  baselineHrv: number | null;
  baselineHeartRate: number | null;
  isAnomaly: number | null;
  anomalyDirection: string | null;
  hrvZScore: number | null;
  heartRateZScore: number | null;
}

interface SleepTrendChartProps {
  data: SleepData[];
  analysisData?: AnalysisPoint[];
  windowDays?: number;
  /** The detector's daily threshold, in standard deviations. */
  threshold?: number;
}

interface MergedHrvPoint {
  day: string;
  hrv: number | null;
  hrvAvg: number | null;
  baselineHrv: number | null;
  isDeviation: boolean;
  noNight: boolean;
}

interface MergedHrPoint {
  day: string;
  hr: number | null;
  hrAvg: number | null;
  baselineHr: number | null;
  isDeviation: boolean;
  noNight: boolean;
}

export function mergeHrvData(
  data: SleepData[],
  analysis: AnalysisPoint[] | undefined,
  threshold: number
): MergedHrvPoint[] {
  const analysisMap = new Map(analysis?.map((a) => [a.day, a]));
  const rollingAvg = computeCalendarRollingAverage(
    data.map((point) => ({
      day: point.day,
      value: point.hrv != null && point.hrv > 0 ? point.hrv : null,
    })),
    7
  );

  return data.map((d, i) => {
    const a = analysisMap.get(d.day);
    const baseline = a?.baselineHrv ?? null;
    return {
      day: d.day,
      hrv: d.hrv,
      hrvAvg: d.noNight ? null : rollingAvg[i],
      baselineHrv: baseline,
      isDeviation: Math.abs(a?.hrvZScore ?? 0) >= threshold,
      noNight: d.noNight ?? false,
    };
  });
}

export function mergeHrData(
  data: SleepData[],
  analysis: AnalysisPoint[] | undefined,
  threshold: number
): MergedHrPoint[] {
  const analysisMap = new Map(analysis?.map((a) => [a.day, a]));
  const rollingAvg = computeCalendarRollingAverage(
    data.map((point) => ({
      day: point.day,
      value: point.hr != null && point.hr > 0 ? point.hr : null,
    })),
    7
  );

  return data.map((d, i) => {
    const a = analysisMap.get(d.day);
    const baseline = a?.baselineHeartRate ?? null;
    return {
      day: d.day,
      hr: d.hr,
      hrAvg: d.noNight ? null : rollingAvg[i],
      baselineHr: baseline,
      isDeviation: Math.abs(a?.heartRateZScore ?? 0) >= threshold,
      noNight: d.noNight ?? false,
    };
  });
}

interface HrvTooltipItem {
  dataKey: string;
  value: number | null;
  color: string;
  payload: MergedHrvPoint;
}

export function HrvTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: HrvTooltipItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.noNight) {
    return <NoNightTooltip title={formatNightLabel(p.day, { weekday: false })} />;
  }
  if (!hasValues(payload)) return null;
  return (
    <ChartTooltipFrame title={formatNightLabel(p.day, { weekday: false })}>
      <ChartTooltipRow
        color={CHART.hrv}
        label="HRV"
        value={`${p.hrv?.toFixed(0) ?? "--"} ms`}
      />
      {p.hrvAvg != null && (
        <ChartTooltipRow muted label="7-day avg" value={`${p.hrvAvg.toFixed(0)} ms`} />
      )}
      {p.baselineHrv != null && (
        <ChartTooltipRow muted label="Usual" value={`${p.baselineHrv.toFixed(0)} ms`} />
      )}
      {p.isDeviation && (
        <p className="mt-1 text-xs text-attention">
          Unusual for the pattern checks
        </p>
      )}
    </ChartTooltipFrame>
  );
}

interface HrTooltipItem {
  dataKey: string;
  value: number | null;
  color: string;
  payload: MergedHrPoint;
}

export function HrTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: HrTooltipItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.noNight) {
    return <NoNightTooltip title={formatNightLabel(p.day, { weekday: false })} />;
  }
  if (!hasValues(payload)) return null;
  return (
    <ChartTooltipFrame title={formatNightLabel(p.day, { weekday: false })}>
      <ChartTooltipRow
        color={CHART.heartRate}
        label="Heart rate"
        value={`${p.hr?.toFixed(0) ?? "--"} bpm`}
      />
      {p.hrAvg != null && (
        <ChartTooltipRow muted label="7-day avg" value={`${p.hrAvg.toFixed(0)} bpm`} />
      )}
      {p.baselineHr != null && (
        <ChartTooltipRow muted label="Usual" value={`${p.baselineHr.toFixed(0)} bpm`} />
      )}
      {p.isDeviation && (
        <p className="mt-1 text-xs text-attention">
          Unusual for the pattern checks
        </p>
      )}
    </ChartTooltipFrame>
  );
}

const formatHours = (hours: number | null) =>
  hours == null ? "--" : `${hours.toFixed(1)}h`;

export function DurationTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload: SleepData }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.noNight) return <NoNightTooltip title={`Date: ${p.day}`} />;
  if (!hasValues(payload)) return null;
  return (
    <ChartTooltipFrame title={`Date: ${p.day}`}>
      <ChartTooltipRow color={CHART.deep} label="Deep" value={formatHours(p.deep)} />
      <ChartTooltipRow color={CHART.rem} label="REM" value={formatHours(p.rem)} />
      <ChartTooltipRow color={CHART.light} label="Light" value={formatHours(p.light)} />
    </ChartTooltipFrame>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AnomalyDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.isDeviation) return isolatedDot(props);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="var(--attention)"
      stroke="none"
    />
  );
}

export function SleepTrendChart({
  data,
  analysisData,
  windowDays = 30,
  threshold = 1.5,
}: SleepTrendChartProps) {
  const hrvData = mergeHrvData(data, analysisData, threshold);
  const hrData = mergeHrData(data, analysisData, threshold);
  const hasHrvBaseline =
    analysisData?.some((point) => point.baselineHrv != null) ?? false;
  const hasHrBaseline =
    analysisData?.some((point) => point.baselineHeartRate != null) ?? false;

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sleep Duration</CardTitle>
          <CardDescription>
            Hours in each stage, last {windowDays} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tickFormatter={(d) => d.slice(5)}
                fontSize={11}
                tick={{ fill: "var(--muted-foreground)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, "auto"]}
                tickFormatter={(v) => `${v}h`}
                fontSize={11}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                content={<DurationTooltipContent />}
                filterNull={false}
              />
              <Legend formatter={legendLabel} />
              <Area
                type="monotone"
                dataKey="deep"
                stackId="1"
                stroke="var(--stage-deep)"
                fill="var(--stage-deep)"
                fillOpacity={0.6}
                dot={isolatedDot}
                name="Deep"
              />
              <Area
                type="monotone"
                dataKey="rem"
                stackId="1"
                stroke="var(--stage-rem)"
                fill="var(--stage-rem)"
                fillOpacity={0.6}
                dot={isolatedDot}
                name="REM"
              />
              <Area
                type="monotone"
                dataKey="light"
                stackId="1"
                stroke="var(--stage-light)"
                fill="var(--stage-light)"
                fillOpacity={0.4}
                dot={isolatedDot}
                name="Light"
              />
            </AreaChart>
          </ResponsiveContainer>
          <GapNote rows={data} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Heart Rate Variability</CardTitle>
            <CardDescription>Average HRV during sleep (ms)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={hrvData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => d.slice(5)}
                  fontSize={11}
                  tick={{ fill: "var(--muted-foreground)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  // Fit the night-to-night range; from zero it flattens.
                  domain={[
                    (min: number) => Math.max(0, Math.floor(min - 4)),
                    (max: number) => Math.ceil(max + 4),
                  ]}
                  allowDecimals={false}
                  fontSize={11}
                  tick={{ fill: "var(--muted-foreground)" }}
                />
                <Tooltip content={<HrvTooltipContent />} filterNull={false} />
                <Line
                  type="monotone"
                  dataKey="hrv"
                  stroke="var(--series-hrv)"
                  strokeWidth={2}
                  dot={<AnomalyDot />}
                  activeDot={{ r: 4, fill: "var(--series-hrv)" }}
                  name="HRV"
                />
                <Line
                  type="monotone"
                  dataKey="hrvAvg"
                  stroke="var(--series-hrv)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={false}
                  name="7-day avg"
                />
                {hasHrvBaseline && (
                  <Line
                    type="monotone"
                    dataKey="baselineHrv"
                    stroke="var(--muted-foreground)"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    strokeOpacity={0.4}
                    dot={false}
                    activeDot={false}
                    name="Baseline"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <GapNote rows={data} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sleeping Heart Rate</CardTitle>
            <CardDescription>Average heart rate during sleep (bpm)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={hrData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => d.slice(5)}
                  fontSize={11}
                  tick={{ fill: "var(--muted-foreground)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  // Fit the night-to-night range; from zero it flattens.
                  domain={[
                    (min: number) => Math.max(0, Math.floor(min - 4)),
                    (max: number) => Math.ceil(max + 4),
                  ]}
                  allowDecimals={false}
                  fontSize={11}
                  tick={{ fill: "var(--muted-foreground)" }}
                />
                <Tooltip content={<HrTooltipContent />} filterNull={false} />
                <Line
                  type="monotone"
                  dataKey="hr"
                  stroke="var(--series-hr)"
                  strokeWidth={2}
                  dot={<AnomalyDot />}
                  activeDot={{ r: 4, fill: "var(--series-hr)" }}
                  name="Heart Rate"
                />
                <Line
                  type="monotone"
                  dataKey="hrAvg"
                  stroke="var(--series-hr)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={false}
                  name="7-day avg"
                />
                {hasHrBaseline && (
                  <Line
                    type="monotone"
                    dataKey="baselineHr"
                    stroke="var(--muted-foreground)"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    strokeOpacity={0.4}
                    dot={false}
                    activeDot={false}
                    name="Baseline"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
            <GapNote rows={data} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
