"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceDot,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResearchTooltip } from "@/components/research-tooltip";
import {
  GapNote,
  type GapRow,
  NoNightTooltip,
  hasValues,
  isolatedDot,
} from "./chart-gaps";
import { AXIS_TICK, CHART, legendLabel } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";

interface ActivityPoint extends GapRow {
  day: string;
  steps: number | null;
  activeMinutes: number | null;
  stressHigh: number | null;
  recoveryHigh: number | null;
  resilienceLevel: string | null;
  workoutCount?: number;
  workoutCalories?: number | null;
  workoutTypes?: string[];
}

interface ActivityRecoveryChartProps {
  data: ActivityPoint[];
  limitations?: string;
}

interface ActivityTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload: ActivityPoint }>;
}

/** Neutral series only: the first in Moonlight, the next in Mist. */
const MOONLIGHT = "var(--foreground)";
const MIST = CHART.axis;

export function ActivityTooltipContent({ active, payload }: ActivityTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.noNight) return <NoNightTooltip title={p.day} />;
  if (!hasValues(payload)) return null;
  return (
    <ChartTooltipFrame title={p.day}>
      {p.steps != null && (
        <ChartTooltipRow color={MIST} label="Steps" value={p.steps.toLocaleString()} />
      )}
      {p.activeMinutes != null && (
        <ChartTooltipRow color={MOONLIGHT} label="Active" value={`${p.activeMinutes} min`} />
      )}
      {p.stressHigh != null && (
        <ChartTooltipRow muted label="Stress" value={`${p.stressHigh} min`} />
      )}
      {p.recoveryHigh != null && (
        <ChartTooltipRow muted label="Recovery" value={`${p.recoveryHigh} min`} />
      )}
      {p.resilienceLevel && (
        <ChartTooltipRow muted label="Resilience" value={p.resilienceLevel} />
      )}
      {(p.workoutCount ?? 0) > 0 && (
        <>
          <ChartTooltipRow
            label="Workouts"
            value={`${p.workoutCount}${
              p.workoutCalories != null
                ? ` (${p.workoutCalories.toFixed(0)} cal)`
                : ""
            }`}
          />
          {p.workoutCalories == null && (
            <p className="text-muted-foreground text-xs">
              Calories unavailable
            </p>
          )}
          {p.workoutTypes && p.workoutTypes.length > 0 && (
            <p className="text-muted-foreground text-xs">{p.workoutTypes.join(", ")}</p>
          )}
        </>
      )}
    </ChartTooltipFrame>
  );
}

export function StressTooltipContent({ active, payload }: ActivityTooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.noNight) return <NoNightTooltip title={p.day} />;
  if (!hasValues(payload)) return null;
  return (
    <ChartTooltipFrame title={p.day}>
      {p.stressHigh != null && (
        <ChartTooltipRow color={MOONLIGHT} label="Stress High" value={`${p.stressHigh} min`} />
      )}
      {p.recoveryHigh != null && (
        <ChartTooltipRow color={MIST} label="Recovery High" value={`${p.recoveryHigh} min`} />
      )}
      {p.resilienceLevel && (
        <ChartTooltipRow muted label="Resilience" value={p.resilienceLevel} />
      )}
    </ChartTooltipFrame>
  );
}

export function ActivityRecoveryChart({ data, limitations }: ActivityRecoveryChartProps) {
  const hasActivityData = data.some(
    (point) => point.steps != null || point.activeMinutes != null
  );
  const hasStressRecoveryData = data.some(
    (point) => point.stressHigh != null || point.recoveryHigh != null
  );
  const hasWorkouts = data.some((point) => (point.workoutCount ?? 0) > 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Activity
            <ResearchTooltip metric="activityLevel" />
          </CardTitle>
          <CardDescription>Daily steps + active minutes</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 max-w-prose text-sm text-muted-foreground">
            <span className="font-medium text-foreground">What to watch for:</span>{" "}
            Compare sustained activity changes with your personal baseline. Research has linked specialized
            step-variability signals with later depressive symptoms, but a simple drop in steps or active minutes is
            not a validated episode predictor. Oura stress reflects physiological load, not necessarily emotional stress.
          </p>
          {hasActivityData ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => d.slice(5)}
                  tick={AXIS_TICK}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="steps"
                  orientation="left"
                  tick={AXIS_TICK}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="mins"
                  orientation="right"
                  tick={AXIS_TICK}
                />
                <Tooltip content={<ActivityTooltipContent />} filterNull={false} />
                <Legend formatter={legendLabel} />
                <Bar
                  yAxisId="steps"
                  dataKey="steps"
                  fill={MIST}
                  fillOpacity={0.4}
                  name="Steps"
                />
                <Line
                  yAxisId="mins"
                  type="monotone"
                  dataKey="activeMinutes"
                  stroke={MOONLIGHT}
                  strokeWidth={2}
                  dot={isolatedDot}
                  name="Active Min"
                  connectNulls={false}
                />
                {data.map((d, i) =>
                  (d.workoutCount ?? 0) > 0 ? (
                    <ReferenceDot
                      key={i}
                      x={d.day}
                      y={d.steps ?? 0}
                      yAxisId="steps"
                      r={4}
                      fill="var(--card)"
                      stroke={MOONLIGHT}
                      strokeWidth={1.5}
                    />
                  ) : null
                )}
                </ComposedChart>
              </ResponsiveContainer>
              {hasWorkouts && (
                <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full border-[1.5px] border-foreground"
                  />
                  Days with a workout
                </p>
              )}
              <GapNote rows={data} />
            </>
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
              No daily steps or active-minute values are available for this
              range.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stress &amp; Recovery</CardTitle>
          <CardDescription>
            Minutes Oura labelled as high stress or restorative time; resilience
            appears in the tooltip when available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasStressRecoveryData ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
              <XAxis
                dataKey="day"
                tickFormatter={(d) => d.slice(5)}
                tick={AXIS_TICK}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={AXIS_TICK}
                tickFormatter={(value) => `${value}m`}
              />
              <Tooltip content={<StressTooltipContent />} filterNull={false} />
              <Legend formatter={legendLabel} />
              <Line
                type="monotone"
                dataKey="stressHigh"
                stroke={MOONLIGHT}
                strokeWidth={2}
                dot={isolatedDot}
                name="High stress (min)"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="recoveryHigh"
                stroke={MIST}
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={isolatedDot}
                name="Restorative (min)"
                connectNulls={false}
              />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
              No Oura high-stress or restorative-time values are available for
              this range.
            </div>
          )}
          {hasStressRecoveryData && <GapNote rows={data} />}
          {limitations && (
            <p className="text-xs text-muted-foreground mt-2">{limitations}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
