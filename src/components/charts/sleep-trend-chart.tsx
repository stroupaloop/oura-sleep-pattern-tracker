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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computeCalendarRollingAverage } from "@/lib/dashboard-metrics";

interface SleepData {
  day: string;
  hours: number;
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
}

interface MergedHrvPoint {
  day: string;
  hrv: number | null;
  hrvAvg: number | null;
  baselineHrv: number | null;
  isDeviation: boolean;
}

interface MergedHrPoint {
  day: string;
  hr: number | null;
  hrAvg: number | null;
  baselineHr: number | null;
  isDeviation: boolean;
}

function mergeHrvData(data: SleepData[], analysis?: AnalysisPoint[]): MergedHrvPoint[] {
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
      hrvAvg: rollingAvg[i],
      baselineHrv: baseline,
      isDeviation: Math.abs(a?.hrvZScore ?? 0) >= 2,
    };
  });
}

function mergeHrData(data: SleepData[], analysis?: AnalysisPoint[]): MergedHrPoint[] {
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
      hrAvg: rollingAvg[i],
      baselineHr: baseline,
      isDeviation: Math.abs(a?.heartRateZScore ?? 0) >= 2,
    };
  });
}

interface HrvTooltipItem {
  dataKey: string;
  value: number;
  color: string;
  payload: MergedHrvPoint;
}

function HrvTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: HrvTooltipItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      <p style={{ color: "#34d399" }}>HRV: {p.hrv?.toFixed(0) ?? "--"} ms</p>
      {p.hrvAvg != null && (
        <p className="text-muted-foreground">7-day avg: {p.hrvAvg.toFixed(0)} ms</p>
      )}
      {p.baselineHrv != null && (
        <p className="text-muted-foreground">Baseline: {p.baselineHrv.toFixed(0)} ms</p>
      )}
      {p.isDeviation && (
        <p className="text-red-400 text-xs mt-1">
          At least 2 standard deviations from baseline
        </p>
      )}
    </div>
  );
}

interface HrTooltipItem {
  dataKey: string;
  value: number;
  color: string;
  payload: MergedHrPoint;
}

function HrTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: HrTooltipItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      <p style={{ color: "#f87171" }}>HR: {p.hr?.toFixed(0) ?? "--"} bpm</p>
      {p.hrAvg != null && (
        <p className="text-muted-foreground">7-day avg: {p.hrAvg.toFixed(0)} bpm</p>
      )}
      {p.baselineHr != null && (
        <p className="text-muted-foreground">Baseline: {p.baselineHr.toFixed(0)} bpm</p>
      )}
      {p.isDeviation && (
        <p className="text-red-400 text-xs mt-1">
          At least 2 standard deviations from baseline
        </p>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AnomalyDot(props: any) {
  const { cx, cy, payload } = props;
  if (!payload?.isDeviation) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill="#ef4444"
      stroke="none"
    />
  );
}

export function SleepTrendChart({ data, analysisData }: SleepTrendChartProps) {
  const hrvData = mergeHrvData(data, analysisData);
  const hrData = mergeHrData(data, analysisData);
  const hasHrvBaseline =
    analysisData?.some((point) => point.baselineHrv != null) ?? false;
  const hasHrBaseline =
    analysisData?.some((point) => point.baselineHeartRate != null) ?? false;

  return (
    <div className="space-y-4 md:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sleep Duration</CardTitle>
          <CardDescription>Total hours by sleep stage (last 30 nights)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
              <XAxis
                dataKey="day"
                tickFormatter={(d) => d.slice(5)}
                fontSize={11}
                tick={{ fill: "oklch(0.708 0 0)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, "auto"]}
                tickFormatter={(v) => `${v}h`}
                fontSize={11}
                tick={{ fill: "oklch(0.708 0 0)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "oklch(0.205 0 0)",
                  borderColor: "oklch(1 0 0 / 10%)",
                  borderRadius: "0.5rem",
                  color: "oklch(0.985 0 0)",
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [
                  `${Number(value).toFixed(1)}h`,
                  String(name).charAt(0).toUpperCase() + String(name).slice(1),
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="deep"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="Deep"
              />
              <Area
                type="monotone"
                dataKey="rem"
                stackId="1"
                stroke="#a78bfa"
                fill="#a78bfa"
                fillOpacity={0.6}
                name="REM"
              />
              <Area
                type="monotone"
                dataKey="light"
                stackId="1"
                stroke="#67e8f9"
                fill="#67e8f9"
                fillOpacity={0.4}
                name="Light"
              />
            </AreaChart>
          </ResponsiveContainer>
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
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => d.slice(5)}
                  fontSize={11}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  fontSize={11}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                />
                <Tooltip content={<HrvTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="hrv"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={<AnomalyDot />}
                  activeDot={{ r: 4, fill: "#34d399" }}
                  name="HRV"
                />
                <Line
                  type="monotone"
                  dataKey="hrvAvg"
                  stroke="#34d399"
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
                    stroke="oklch(0.708 0 0)"
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resting Heart Rate</CardTitle>
            <CardDescription>Average HR during sleep (bpm)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={hrData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => d.slice(5)}
                  fontSize={11}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  fontSize={11}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                />
                <Tooltip content={<HrTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="hr"
                  stroke="#f87171"
                  strokeWidth={2}
                  dot={<AnomalyDot />}
                  activeDot={{ r: 4, fill: "#f87171" }}
                  name="Heart Rate"
                />
                <Line
                  type="monotone"
                  dataKey="hrAvg"
                  stroke="#f87171"
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
                    stroke="oklch(0.708 0 0)"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
