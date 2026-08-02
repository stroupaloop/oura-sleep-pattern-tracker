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

interface WithinNightPoint {
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
  payload: WithinNightPoint;
}

function WithinNightTooltipContent({
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
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      {mode === "cv" && p.hrvCV != null && (
        <p style={{ color: "#60a5fa" }}>HRV CV: {(p.hrvCV * 100).toFixed(1)}%</p>
      )}
      {mode === "cv" && p.hrCV != null && (
        <p style={{ color: "#a78bfa" }}>HR CV: {(p.hrCV * 100).toFixed(1)}%</p>
      )}
      {mode === "fragmentation" && p.fragmentation != null && (
        <p style={{ color: "#f59e0b" }}>
          Adjacent intervals with a stage change:{" "}
          {(p.fragmentation * 100).toFixed(1)}%
        </p>
      )}
    </div>
  );
}

export function WithinNightChart({ data, limitations }: WithinNightChartProps) {
  const hasCvData = data.some(
    (point) => point.hrvCV != null || point.hrCV != null
  );
  const hasFragmentationData = data.some(
    (point) => point.fragmentation != null
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
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
          <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-medium">
            Exploratory Signal
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2 mb-4 text-xs text-amber-200/80">
          These app-derived CV and transition measures are exploratory and are
          not the study-specific sleep-stage signal.
        </div>
        <div className="rounded-md bg-blue-500/5 border border-blue-500/20 px-3 py-2 mb-4 text-xs text-blue-200/80">
          <span className="font-medium text-blue-300">What to watch for:</span>{" "}
          Higher values mean more within-night variation. Compare sustained
          changes with your own history; there is no universal good range.
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
                      tickFormatter={(value) =>
                        `${(value * 100).toFixed(0)}%`
                      }
                    />
                    <Tooltip
                      content={<WithinNightTooltipContent mode="cv" />}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="hrvCV"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      dot={false}
                      name="HRV CV"
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="hrCV"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      dot={false}
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
                      tickFormatter={(value) =>
                        `${(value * 100).toFixed(0)}%`
                      }
                    />
                    <Tooltip
                      content={
                        <WithinNightTooltipContent mode="fragmentation" />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="fragmentation"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="Sleep-stage changes"
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
        )}
        {limitations && (
          <p className="text-xs text-muted-foreground mt-2">{limitations}</p>
        )}
      </CardContent>
    </Card>
  );
}
