"use client";

import {
  Bar,
  Cell,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Episode {
  day: string;
  tier: string;
  direction: string | null;
  confidence: number;
  primaryDrivers: string | null;
}

interface SelfReport {
  day: string;
  episodeState: string;
}

interface Thresholds {
  watch: number;
  warning: number;
  alert: number;
}

interface TimelinePoint {
  day: string;
  score: number | null;
  direction: string | null;
  tier: string | null;
  drivers: string[];
  selfReport: string | null;
}

function getBarColor(point: TimelinePoint): string {
  if (point.tier === "alert") return "#ef4444";
  if (point.tier === "warning") return "#f59e0b";
  if (point.tier === "watch") return "#3b82f6";
  return "oklch(0.708 0 0 / 35%)";
}

function getSelfReportColor(state: string): string {
  if (state === "depressive") return "#60a5fa";
  if (state === "hypomanic" || state === "manic") return "#fbbf24";
  return "#c084fc";
}

function formatEpisodeState(state: string): string {
  return state.charAt(0).toUpperCase() + state.slice(1);
}

interface TooltipPayloadItem {
  payload: TimelinePoint;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{point.day}</p>
      <p className="text-muted-foreground">
        Evidence:{" "}
        {point.score != null ? `${point.score.toFixed(1)}/10` : "Unavailable"}
      </p>
      {point.direction && (
        <p
          style={{
            color: point.direction === "hyper" ? "#f59e0b" : "#3b82f6",
          }}
        >
          {point.direction === "hyper"
            ? "Higher-activation"
            : "Lower-activation"}{" "}
          direction
        </p>
      )}
      {point.tier && point.tier !== "none" && (
        <p className="text-muted-foreground capitalize">
          Pattern flag: {point.tier}
        </p>
      )}
      {point.selfReport && (
        <p className="text-muted-foreground">
          Self-report: {formatEpisodeState(point.selfReport)}
        </p>
      )}
      {point.drivers.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Drivers: {point.drivers.join(", ")}
        </p>
      )}
    </div>
  );
}

function buildTimeline(
  episodes: Episode[],
  selfReports: SelfReport[]
): TimelinePoint[] {
  const points = new Map<string, TimelinePoint>();
  for (const episode of episodes) {
    let drivers: string[] = [];
    if (episode.primaryDrivers) {
      try {
        drivers = JSON.parse(episode.primaryDrivers);
      } catch {
        drivers = [];
      }
    }
    points.set(episode.day, {
      day: episode.day,
      score: episode.confidence,
      direction: episode.direction,
      tier: episode.tier,
      drivers,
      selfReport: null,
    });
  }
  for (const report of selfReports) {
    const existing = points.get(report.day);
    points.set(report.day, {
      day: report.day,
      score: existing?.score ?? null,
      direction: existing?.direction ?? null,
      tier: existing?.tier ?? null,
      drivers: existing?.drivers ?? [],
      selfReport: report.episodeState,
    });
  }
  return [...points.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function EpisodeTimeline({
  episodes,
  selfReports,
  thresholds,
}: {
  episodes: Episode[];
  selfReports: SelfReport[];
  thresholds: Thresholds;
}) {
  const data = buildTimeline(episodes, selfReports);
  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-Day Evidence Timeline</CardTitle>
        <CardDescription>
          App heuristic from wearable signals only. Evidence is not episode
          probability.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          Watch ≥ {thresholds.watch} · Warning ≥ {thresholds.warning} · Alert ≥{" "}
          {thresholds.alert} · Consecutive-day rules also apply
        </p>
        <div
          role="img"
          aria-label="Multi-day wearable evidence scores with pattern thresholds and self-reported episode markers"
        >
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart
              data={data}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <XAxis
                dataKey="day"
                tickFormatter={(day: string) => day.slice(5)}
                fontSize={11}
                tick={{ fill: "oklch(0.708 0 0)" }}
              />
              <YAxis
                domain={[0, 10]}
                fontSize={11}
                tick={{ fill: "oklch(0.708 0 0)" }}
                label={{
                  value: "Evidence (0–10)",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "oklch(0.708 0 0)", fontSize: 10 },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine
                y={thresholds.watch}
                stroke="#3b82f6"
                strokeDasharray="3 3"
                strokeOpacity={0.55}
              />
              <ReferenceLine
                y={thresholds.warning}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                strokeOpacity={0.55}
              />
              <ReferenceLine
                y={thresholds.alert}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeOpacity={0.55}
              />
              <Bar dataKey="score" maxBarSize={12} radius={[2, 2, 0, 0]}>
                {data.map((point) => (
                  <Cell key={point.day} fill={getBarColor(point)} />
                ))}
              </Bar>
              {data
                .filter(
                  (point): point is TimelinePoint & { selfReport: string } =>
                    point.selfReport !== null
                )
                .map((point) => (
                  <ReferenceDot
                    key={`self-report-${point.day}`}
                    x={point.day}
                    y={0.25}
                    r={4}
                    fill={getSelfReportColor(point.selfReport)}
                    stroke="var(--background)"
                    strokeWidth={1}
                  />
                ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Dots at the baseline are optional self-reports: blue depressive,
          amber hypomanic or manic, purple mixed.
        </p>
      </CardContent>
    </Card>
  );
}
