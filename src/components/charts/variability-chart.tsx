"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResearchTooltip } from "@/components/research-tooltip";

interface VariabilityPoint {
  day: string;
  sleepCV: number | null;
  bedtimeCV: number | null;
  wakeCV: number | null;
}

interface VariabilityChartProps {
  data: VariabilityPoint[];
  limitations?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VariabilityTooltipContent({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as VariabilityPoint;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      {p.sleepCV != null && (
        <p style={{ color: "#3b82f6" }}>Sleep Duration CV: {(p.sleepCV * 100).toFixed(1)}%</p>
      )}
      {p.bedtimeCV != null && (
        <p style={{ color: "#f59e0b" }}>Bedtime CV: {(p.bedtimeCV * 100).toFixed(1)}%</p>
      )}
      {p.wakeCV != null && (
        <p style={{ color: "#34d399" }}>Wake Time CV: {(p.wakeCV * 100).toFixed(1)}%</p>
      )}
    </div>
  );
}

export function VariabilityChart({ data, limitations }: VariabilityChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sleep Variability (Day-to-Day)
          <ResearchTooltip metric="sleepDuration" />
        </CardTitle>
        <CardDescription>
          Coefficient of variation for sleep duration, bedtime, and wake time (7-day rolling window)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md bg-blue-500/5 border border-blue-500/20 px-3 py-2 mb-4 text-xs text-blue-200/80">
          <span className="font-medium text-blue-300">What to watch for:</span>{" "}
          Rising CV values mean your sleep schedule is becoming more irregular. Bedtime CV is especially important —
          erratic bedtimes disrupt circadian rhythm and are an early warning sign. Activity variability predicts
          depressive episodes up to 7 days before onset. Stable, low CV values generally indicate euthymia.
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
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
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip content={<VariabilityTooltipContent />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="sleepCV"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Sleep Duration CV"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="bedtimeCV"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Bedtime CV"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="wakeCV"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              name="Wake Time CV"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
        {limitations && (
          <p className="text-xs text-muted-foreground mt-2">{limitations}</p>
        )}
      </CardContent>
    </Card>
  );
}
