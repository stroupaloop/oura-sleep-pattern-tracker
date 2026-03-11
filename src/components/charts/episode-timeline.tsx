"use client";

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AnalysisDay {
  day: string;
  anomalyScore: number | null;
  isAnomaly: number | null;
  anomalyDirection: string | null;
}

interface Episode {
  day: string;
  tier: string;
  direction: string | null;
  confidence: number;
  primaryDrivers: string | null;
}

interface TimelinePoint {
  day: string;
  score: number;
  isAnomaly: boolean;
  direction: string | null;
  tier: string | null;
  drivers: string[];
}

function getBarColor(point: TimelinePoint): string {
  if (point.tier === "alert") return "#ef4444";
  if (point.tier === "warning") return "#f59e0b";
  if (point.tier === "watch") return "#3b82f6";
  if (point.tier && point.tier !== "none") return "#a855f7";
  if (!point.isAnomaly) return "oklch(0.708 0 0 / 30%)";
  return "oklch(0.708 0 0 / 50%)";
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
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      <p className="text-muted-foreground">
        Score: {p.score.toFixed(1)}
        {p.isAnomaly && " (anomaly)"}
      </p>
      {p.direction && (
        <p style={{ color: p.direction === "hyper" ? "#f59e0b" : "#3b82f6" }}>
          {p.direction === "hyper" ? "Hypomanic" : "Depressive"} direction
        </p>
      )}
      {p.tier && p.tier !== "none" && (
        <p className="text-muted-foreground">Tier: {p.tier}</p>
      )}
      {p.drivers.length > 0 && (
        <p className="text-muted-foreground text-xs mt-1">
          Drivers: {p.drivers.join(", ")}
        </p>
      )}
    </div>
  );
}

function getEpisodeSpans(episodes: Episode[]): { day: string; tier: string }[] {
  return episodes
    .filter((e) => e.tier !== "none")
    .map((e) => ({ day: e.day, tier: e.tier }));
}

function getTierColor(tier: string): string {
  if (tier === "alert") return "rgba(239, 68, 68, 0.12)";
  if (tier === "warning") return "rgba(245, 158, 11, 0.12)";
  return "rgba(59, 130, 246, 0.12)";
}

export function EpisodeTimeline({
  analysisData,
  episodes,
}: {
  analysisData: AnalysisDay[];
  episodes: Episode[];
}) {
  const episodeMap = new Map(episodes.map((e) => [e.day, e]));

  const data: TimelinePoint[] = analysisData
    .map((a) => {
      const ep = episodeMap.get(a.day);
      let drivers: string[] = [];
      if (ep?.primaryDrivers) {
        try {
          drivers = JSON.parse(ep.primaryDrivers);
        } catch {
          drivers = [];
        }
      }
      return {
        day: a.day,
        score: Math.abs(a.anomalyScore ?? 0),
        isAnomaly: a.isAnomaly === 1,
        direction: a.anomalyDirection,
        tier: ep?.tier ?? null,
        drivers,
      };
    })
    .reverse();

  if (data.length === 0) return null;

  const episodeSpans = getEpisodeSpans(episodes);
  const maxScore = Math.max(...data.map((d) => d.score), 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly Timeline</CardTitle>
        <CardDescription>
          Daily anomaly scores with episode detection spans
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis
              dataKey="day"
              tickFormatter={(d: string) => d.slice(5)}
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
            />
            <YAxis
              domain={[0, Math.ceil(maxScore)]}
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              label={{
                value: "Score",
                angle: -90,
                position: "insideLeft",
                style: { fill: "oklch(0.708 0 0)", fontSize: 10 },
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            {episodeSpans.map((span) => (
              <ReferenceArea
                key={span.day}
                x1={span.day}
                x2={span.day}
                y1={0}
                y2={Math.ceil(maxScore)}
                fill={getTierColor(span.tier)}
                fillOpacity={1}
              />
            ))}
            <Bar dataKey="score" maxBarSize={12} radius={[2, 2, 0, 0]}>
              {data.map((point, idx) => (
                <Cell key={idx} fill={getBarColor(point)} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
