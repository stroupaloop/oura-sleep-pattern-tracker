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
import { AXIS_TICK, CHART, legendLabel } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";

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

/** Neutral series only: the first in Moonlight, the next in Mist dashed. */
const MOONLIGHT = "var(--foreground)";
const MIST = CHART.axis;

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
    <ChartTooltipFrame title={p.day}>
      {mode === "sleep" && p.sleepCV != null && (
        <ChartTooltipRow
          color={MOONLIGHT}
          label="Sleep Duration CV"
          value={`${(p.sleepCV * 100).toFixed(1)}%`}
        />
      )}
      {mode === "clock" && p.bedtimeCV != null && (
        <ChartTooltipRow
          color={MOONLIGHT}
          label="Bedtime variation index"
          value={p.bedtimeCV.toFixed(3)}
        />
      )}
      {mode === "clock" && p.wakeCV != null && (
        <ChartTooltipRow
          color={MIST}
          label="Wake-time variation index"
          value={p.wakeCV.toFixed(3)}
        />
      )}
    </ChartTooltipFrame>
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
        <p className="mb-4 max-w-prose text-sm text-muted-foreground">
          <span className="font-medium text-foreground">What to watch for:</span>{" "}
          Rising values mean the measured schedule is becoming more variable.
          Compare sustained changes with your own baseline; these rolling
          metrics do not determine mood state or predict an episode on their own.
        </p>
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
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(d) => d.slice(5)}
                      tick={AXIS_TICK}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      content={<VariabilityTooltipContent mode="sleep" />}
                    />
                    <Line
                      type="monotone"
                      dataKey="sleepCV"
                      stroke={MOONLIGHT}
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
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={(d) => d.slice(5)}
                      tick={AXIS_TICK}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, "auto"]}
                      tick={AXIS_TICK}
                      tickFormatter={(value) => Number(value).toFixed(2)}
                    />
                    <Tooltip
                      content={<VariabilityTooltipContent mode="clock" />}
                    />
                    <Legend formatter={legendLabel} />
                    <Line
                      type="monotone"
                      dataKey="bedtimeCV"
                      stroke={MOONLIGHT}
                      strokeWidth={2}
                      dot={false}
                      name="Bedtime variation"
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="wakeCV"
                      stroke={MIST}
                      strokeDasharray="6 4"
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
