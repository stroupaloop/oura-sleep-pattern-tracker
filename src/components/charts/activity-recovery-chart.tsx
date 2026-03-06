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
  Area,
  AreaChart,
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
}

interface ActivityRecoveryChartProps {
  data: ActivityPoint[];
  limitations?: string;
}

function resilienceToNumber(level: string | null): number | null {
  if (!level) return null;
  const map: Record<string, number> = {
    limited: 1,
    adequate: 2,
    solid: 3,
    strong: 4,
    exceptional: 5,
  };
  return map[level] ?? null;
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
      {p.stressHigh != null && <p style={{ color: "#f87171" }}>Stress: {p.stressHigh} min</p>}
      {p.recoveryHigh != null && <p style={{ color: "#a78bfa" }}>Recovery: {p.recoveryHigh} min</p>}
      {p.resilienceLevel && <p className="text-muted-foreground">Resilience: {p.resilienceLevel}</p>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function StressTooltipContent({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as ActivityPoint & { resilience: number | null };
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      {p.stressHigh != null && <p style={{ color: "#f87171" }}>Stress High: {p.stressHigh} min</p>}
      {p.recoveryHigh != null && <p style={{ color: "#a78bfa" }}>Recovery High: {p.recoveryHigh} min</p>}
      {p.resilienceLevel && <p className="text-muted-foreground">Resilience: {p.resilienceLevel}</p>}
    </div>
  );
}

export function ActivityRecoveryChart({ data, limitations }: ActivityRecoveryChartProps) {
  const stressData = data.map((d) => ({
    ...d,
    resilience: resilienceToNumber(d.resilienceLevel),
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Activity
            <ResearchTooltip metric="activityLevel" />
          </CardTitle>
          <CardDescription>Daily steps + active minutes</CardDescription>
        </CardHeader>
        <CardContent>
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
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stress &amp; Recovery</CardTitle>
          <CardDescription>Stress vs recovery time + resilience level</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={stressData}>
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
              <Tooltip content={<StressTooltipContent />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="stressHigh"
                stackId="1"
                stroke="#f87171"
                fill="#f87171"
                fillOpacity={0.4}
                name="Stress"
                connectNulls
              />
              <Area
                type="monotone"
                dataKey="recoveryHigh"
                stackId="1"
                stroke="#a78bfa"
                fill="#a78bfa"
                fillOpacity={0.4}
                name="Recovery"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
          {limitations && (
            <p className="text-xs text-muted-foreground mt-2">{limitations}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
