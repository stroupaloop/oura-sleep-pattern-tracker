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

interface ActivityPoint {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActivityTooltipContent({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ActivityPoint;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      {p.steps != null && <p style={{ color: "#3b82f6" }}>Steps: {p.steps.toLocaleString()}</p>}
      {p.activeMinutes != null && <p style={{ color: "#34d399" }}>Active: {p.activeMinutes} min</p>}
      {p.stressHigh != null && <p style={{ color: "#60a5fa" }}>Stress: {p.stressHigh} min</p>}
      {p.recoveryHigh != null && <p style={{ color: "#a78bfa" }}>Recovery: {p.recoveryHigh} min</p>}
      {p.resilienceLevel && <p className="text-muted-foreground">Resilience: {p.resilienceLevel}</p>}
      {(p.workoutCount ?? 0) > 0 && (
        <>
          <p style={{ color: "#fb923c" }}>
            Workouts: {p.workoutCount}
            {p.workoutCalories != null
              ? ` (${p.workoutCalories.toFixed(0)} cal)`
              : ""}
          </p>
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
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StressTooltipContent({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ActivityPoint;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      {p.stressHigh != null && <p style={{ color: "#60a5fa" }}>Stress High: {p.stressHigh} min</p>}
      {p.recoveryHigh != null && <p style={{ color: "#a78bfa" }}>Recovery High: {p.recoveryHigh} min</p>}
      {p.resilienceLevel && <p className="text-muted-foreground">Resilience: {p.resilienceLevel}</p>}
    </div>
  );
}

export function ActivityRecoveryChart({ data, limitations }: ActivityRecoveryChartProps) {
  const hasActivityData = data.some(
    (point) => point.steps != null || point.activeMinutes != null
  );
  const hasStressRecoveryData = data.some(
    (point) => point.stressHigh != null || point.recoveryHigh != null
  );

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
          <div className="rounded-md bg-blue-500/5 border border-blue-500/20 px-3 py-2 mb-4 text-xs text-blue-200/80">
            <span className="font-medium text-blue-300">What to watch for:</span>{" "}
            Compare sustained activity changes with your personal baseline. Research has linked specialized
            step-variability signals with later depressive symptoms, but a simple drop in steps or active minutes is
            not a validated episode predictor. Oura stress reflects physiological load, not necessarily emotional stress.
          </div>
          {hasActivityData ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
              <XAxis
                dataKey="day"
                tickFormatter={(d) => d.slice(5)}
                fontSize={11}
                tick={{ fill: "oklch(0.708 0 0)" }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="steps"
                orientation="left"
                fontSize={11}
                tick={{ fill: "oklch(0.708 0 0)" }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                yAxisId="mins"
                orientation="right"
                fontSize={11}
                tick={{ fill: "oklch(0.708 0 0)" }}
              />
              <Tooltip content={<ActivityTooltipContent />} />
              <Legend />
              <Bar
                yAxisId="steps"
                dataKey="steps"
                fill="#3b82f6"
                fillOpacity={0.6}
                name="Steps"
              />
              <Line
                yAxisId="mins"
                type="monotone"
                dataKey="activeMinutes"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
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
                    fill="#fb923c"
                    stroke="#fb923c"
                    strokeWidth={1}
                    fillOpacity={0.8}
                  />
                ) : null
              )}
              </ComposedChart>
            </ResponsiveContainer>
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
                tickFormatter={(value) => `${value}m`}
              />
              <Tooltip content={<StressTooltipContent />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="stressHigh"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                name="High stress (min)"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="recoveryHigh"
                stroke="#a78bfa"
                strokeWidth={2}
                dot={false}
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
          {limitations && (
            <p className="text-xs text-muted-foreground mt-2">{limitations}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
