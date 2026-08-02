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

interface VariabilityTooltipPayload {
  payload: VariabilityPoint;
}

function VariabilityTooltipContent({
  active,
  payload,
  mode,
}: {
  active?: boolean;
  payload?: VariabilityTooltipPayload[];
  mode: "sleep" | "clock";
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as VariabilityPoint;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      {mode === "sleep" && p.sleepCV != null && (
        <p style={{ color: "#3b82f6" }}>Sleep Duration CV: {(p.sleepCV * 100).toFixed(1)}%</p>
      )}
      {mode === "clock" && p.bedtimeCV != null && (
        <p style={{ color: "#a78bfa" }}>
          Bedtime variation index: {p.bedtimeCV.toFixed(3)}
        </p>
      )}
      {mode === "clock" && p.wakeCV != null && (
        <p style={{ color: "#22d3ee" }}>
          Wake-time variation index: {p.wakeCV.toFixed(3)}
        </p>
      )}
    </div>
  );
}

export function VariabilityChart({ data, limitations }: VariabilityChartProps) {
  const hasSleepVariability = data.some((point) => point.sleepCV != null);
  const hasClockVariation = data.some(
    (point) => point.bedtimeCV != null || point.wakeCV != null
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Sleep Variability (Day-to-Day)
          <ResearchTooltip metric="sleepDuration" />
        </CardTitle>
        <CardDescription>
          Separate sleep-duration and clock-time scales from rolling windows of
          up to 7 consecutive calendar days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md bg-blue-500/5 border border-blue-500/20 px-3 py-2 mb-4 text-xs text-blue-200/80">
          <span className="font-medium text-blue-300">What to watch for:</span>{" "}
          Rising values mean the measured schedule is becoming more variable.
          Compare sustained changes with your own baseline; these rolling
          metrics do not determine mood state or predict an episode on their own.
        </div>
        {!hasSleepVariability && !hasClockVariation ? (
          <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
            No rolling variability is available yet. A consecutive multi-day
            window with enough measured values is required.
          </div>
        ) : (
          <div className="space-y-5">
            {hasSleepVariability && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Sleep-duration coefficient of variation (%)
                </p>
                <ResponsiveContainer width="100%" height={180}>
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
                      tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      content={<VariabilityTooltipContent mode="sleep" />}
                    />
                    <Line
                      type="monotone"
                      dataKey="sleepCV"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name="Sleep Duration CV"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {hasClockVariation && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Circular clock-time variation index (0 = consistent)
                </p>
                <ResponsiveContainer width="100%" height={180}>
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
                      domain={[0, "auto"]}
                      fontSize={11}
                      tick={{ fill: "oklch(0.708 0 0)" }}
                      tickFormatter={(value) => Number(value).toFixed(2)}
                    />
                    <Tooltip
                      content={<VariabilityTooltipContent mode="clock" />}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="bedtimeCV"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={false}
                      name="Bedtime variation"
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="wakeCV"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      dot={false}
                      name="Wake-time variation"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
        {limitations && (
          <p className="text-xs text-muted-foreground mt-2">{limitations}</p>
        )}
      </CardContent>
    </Card>
  );
}
