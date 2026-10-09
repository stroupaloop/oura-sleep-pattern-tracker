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
import { Pill } from "@/components/ui/pill";
import { ResearchTooltip } from "@/components/research-tooltip";
import {
  GapNote,
  type GapRow,
  NoNightTooltip,
  hasValues,
  isolatedDot,
} from "./chart-gaps";
import { axisDayProps } from "@/lib/health/format";
import { AXIS_TICK, CHART, legendLabel } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";

interface WithinNightPoint extends GapRow {
  day: string;
  hrvCV: number | null;
  hrCV: number | null;
  fragmentation: number | null;
}

interface WithinNightChartProps {
  data: WithinNightPoint[];
  limitations?: string;
}

interface WithinNightTooltipPayload {
  value?: unknown;
  payload: WithinNightPoint;
}

/** Stage changes are neither HRV nor heart rate, so they draw in Moonlight. */
const FRAGMENTATION_COLOR = "var(--foreground)";

export function WithinNightTooltipContent({
  active,
  payload,
  mode,
}: {
  active?: boolean;
  payload?: WithinNightTooltipPayload[];
  mode: "cv" | "fragmentation";
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as WithinNightPoint;
  if (p.noNight) return <NoNightTooltip title={p.day} />;
  if (!hasValues(payload)) return null;
  return (
    <ChartTooltipFrame title={p.day}>
      {mode === "cv" && p.hrvCV != null && (
        <ChartTooltipRow
          color={CHART.hrv}
          label="HRV CV"
          value={`${(p.hrvCV * 100).toFixed(1)}%`}
        />
      )}
      {mode === "cv" && p.hrCV != null && (
        <ChartTooltipRow
          color={CHART.heartRate}
          label="HR CV"
          value={`${(p.hrCV * 100).toFixed(1)}%`}
        />
      )}
      {mode === "fragmentation" && p.fragmentation != null && (
        <ChartTooltipRow
          color={FRAGMENTATION_COLOR}
          label="Adjacent intervals with a stage change"
          value={`${(p.fragmentation * 100).toFixed(1)}%`}
        />
      )}
    </ChartTooltipFrame>
  );
}

export function WithinNightChart({ data, limitations }: WithinNightChartProps) {
  const dayAxis = axisDayProps(data.map((point) => point.day));
  const hasCvData = data.some(
    (point) => point.hrvCV != null || point.hrCV != null
  );
  const hasFragmentationData = data.some(
    (point) => point.fragmentation != null
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              Within-Night Variability
              <ResearchTooltip metric="sleepStageTransitions" />
            </CardTitle>
            <CardDescription>
              Separate cardiovascular variability and sleep-stage transition
              measures for each long-sleep period
            </CardDescription>
          </div>
          <Pill tone="neutral" className="shrink-0">
            Exploratory Signal
          </Pill>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 max-w-prose space-y-2 text-sm text-muted-foreground">
          <p>
            These app-derived CV and transition measures are exploratory and
            are not the study-specific sleep-stage signal.
          </p>
          <p>
            <span className="font-medium text-foreground">What to watch for:</span>{" "}
            Higher values mean more within-night variation. Compare sustained
            changes with your own history; there is no universal good range.
          </p>
        </div>
        {!hasCvData && !hasFragmentationData ? (
          <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
            No eligible 5-minute HR, HRV, or hypnogram series are available
            from long-sleep periods yet.
          </div>
        ) : (
          <div className="space-y-5">
            {hasCvData ? (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Within-night coefficient of variation (%)
                </p>
                <ResponsiveContainer width="100%" height={190}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="day"
                      {...dayAxis}
                      tick={AXIS_TICK}
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      tickFormatter={(value) =>
                        `${(value * 100).toFixed(0)}%`
                      }
                    />
                    <Tooltip
                      content={<WithinNightTooltipContent mode="cv" />}
                      filterNull={false}
                    />
                    <Legend formatter={legendLabel} />
                    <Line
                      type="monotone"
                      dataKey="hrvCV"
                      stroke={CHART.hrv}
                      strokeWidth={2}
                      dot={isolatedDot}
                      name="HRV CV"
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="hrCV"
                      stroke={CHART.heartRate}
                      strokeWidth={2}
                      dot={isolatedDot}
                      name="HR CV"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            {hasFragmentationData ? (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">
                  Adjacent 5-minute intervals with a sleep-stage change (%)
                </p>
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="day"
                      {...dayAxis}
                      tick={AXIS_TICK}
                    />
                    <YAxis
                      domain={[0, "auto"]}
                      tick={AXIS_TICK}
                      tickFormatter={(value) =>
                        `${(value * 100).toFixed(0)}%`
                      }
                    />
                    <Tooltip
                      content={
                        <WithinNightTooltipContent mode="fragmentation" />
                      }
                      filterNull={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="fragmentation"
                      stroke={FRAGMENTATION_COLOR}
                      strokeWidth={2}
                      dot={isolatedDot}
                      name="Sleep-stage changes"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
        )}
        {(hasCvData || hasFragmentationData) && <GapNote rows={data} />}
        {limitations && (
          <p className="text-xs text-muted-foreground mt-2">{limitations}</p>
        )}
      </CardContent>
    </Card>
  );
}
