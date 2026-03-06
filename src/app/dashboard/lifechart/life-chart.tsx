"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AnalysisRow {
  day: string;
  totalSleepMinutes: number | null;
  baselineSleepMinutes: number | null;
  anomalyDirection: string | null;
  isAnomaly: number | null;
  hrvZScore: number | null;
  bedtimeZScore: number | null;
  withinNightHrvCV: number | null;
  steps: number | null;
}

interface MoodRow {
  day: string;
  moodScore: number;
  tags: string | null;
}

interface EpisodeRow {
  day: string;
  tier: string;
  direction: string | null;
}

interface LifeChartProps {
  analysis: AnalysisRow[];
  moods: MoodRow[];
  episodes: EpisodeRow[];
}

function moodColor(score: number): string {
  if (score <= -2) return "#3b82f6";
  if (score === -1) return "#60a5fa";
  if (score === 0) return "#22c55e";
  if (score === 1) return "#fbbf24";
  if (score >= 2) return "#f59e0b";
  return "#6b7280";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SleepTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{p.day}</p>
      <p>Sleep: {p.sleepHours?.toFixed(1) ?? "--"}h</p>
      {p.baselineHours && <p className="text-muted-foreground">Baseline: {p.baselineHours.toFixed(1)}h</p>}
    </div>
  );
}

export function LifeChart({ analysis, moods, episodes }: LifeChartProps) {
  const moodMap = new Map(moods.map((m) => [m.day, m]));
  const episodeMap = new Map(episodes.map((e) => [e.day, e]));

  const allDays = analysis.map((a) => a.day);
  const syncId = "lifechart";

  const moodData = allDays.map((day) => {
    const m = moodMap.get(day);
    return {
      day,
      moodScore: m?.moodScore ?? null,
      color: m ? moodColor(m.moodScore) : "#374151",
      hasMood: !!m,
    };
  });

  const sleepData = analysis.map((a) => ({
    day: a.day,
    sleepHours: a.totalSleepMinutes ? a.totalSleepMinutes / 60 : null,
    baselineHours: a.baselineSleepMinutes ? a.baselineSleepMinutes / 60 : null,
    anomalyDirection: a.anomalyDirection,
  }));

  const metricsData = analysis.map((a) => ({
    day: a.day,
    hrvZ: a.hrvZScore,
    bedtimeZ: a.bedtimeZScore,
    withinNightZ: a.withinNightHrvCV ? a.withinNightHrvCV * 10 : null,
  }));

  const stepsData = analysis.map((a) => ({
    day: a.day,
    steps: a.steps,
  }));

  const tagData = allDays.map((day) => {
    const m = moodMap.get(day);
    let tags: string[] = [];
    if (m?.tags) {
      try { tags = JSON.parse(m.tags); } catch { /* empty */ }
    }
    const ep = episodeMap.get(day);
    return { day, tags, tier: ep?.tier ?? null };
  });

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Mood</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-2">
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={moodData} syncId={syncId}>
              <XAxis dataKey="day" hide />
              <YAxis domain={[-3, 3]} hide />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded border border-border bg-card px-2 py-1 text-xs shadow-md">
                      <p>{p.day}</p>
                      <p>{p.hasMood ? `Mood: ${p.moodScore}` : "No mood logged"}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="moodScore" fill="#6b7280" radius={[2, 2, 0, 0]}>
                {moodData.map((d, i) => (
                  <rect key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Sleep Duration</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-2">
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={sleepData} syncId={syncId}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
              <XAxis dataKey="day" hide />
              <YAxis fontSize={10} tick={{ fill: "oklch(0.708 0 0)" }} tickFormatter={(v) => `${v}h`} />
              <Tooltip content={<SleepTooltip />} />
              <Area
                type="monotone"
                dataKey="baselineHours"
                stroke="oklch(0.708 0 0)"
                strokeWidth={1}
                strokeDasharray="3 3"
                fill="oklch(0.708 0 0)"
                fillOpacity={0.05}
                dot={false}
                name="Baseline"
              />
              <Area
                type="monotone"
                dataKey="sleepHours"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                strokeWidth={1.5}
                dot={false}
                name="Sleep"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Key Metrics (z-scores)</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-2">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={metricsData} syncId={syncId}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
              <XAxis dataKey="day" hide />
              <YAxis fontSize={10} tick={{ fill: "oklch(0.708 0 0)" }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded border border-border bg-card px-2 py-1 text-xs shadow-md">
                      <p>{p.day}</p>
                      {p.hrvZ != null && <p>HRV z: {p.hrvZ.toFixed(1)}</p>}
                      {p.bedtimeZ != null && <p>Bedtime z: {p.bedtimeZ.toFixed(1)}</p>}
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="hrvZ" stroke="#34d399" strokeWidth={1.5} dot={false} name="HRV" connectNulls />
              <Line type="monotone" dataKey="bedtimeZ" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Bedtime" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Activity</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-2">
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={stepsData} syncId={syncId}>
              <XAxis
                dataKey="day"
                tickFormatter={(d) => d.slice(5)}
                fontSize={9}
                tick={{ fill: "oklch(0.708 0 0)" }}
                interval="preserveStartEnd"
              />
              <YAxis fontSize={10} tick={{ fill: "oklch(0.708 0 0)" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded border border-border bg-card px-2 py-1 text-xs shadow-md">
                      <p>{p.day}</p>
                      <p>Steps: {p.steps?.toLocaleString() ?? "--"}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="steps" fill="#3b82f6" fillOpacity={0.5} radius={[1, 1, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Context</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-2">
          <div className="flex gap-0.5 overflow-x-auto">
            {tagData.map((d, i) => {
              const hasTags = d.tags.length > 0;
              const hasEpisode = d.tier && d.tier !== "none";
              if (!hasTags && !hasEpisode) return <div key={i} className="w-2 h-6 bg-muted/30 rounded-sm shrink-0" />;
              return (
                <div
                  key={i}
                  className={`w-2 h-6 rounded-sm shrink-0 ${
                    hasEpisode
                      ? d.tier === "alert" ? "bg-red-500" : d.tier === "warning" ? "bg-amber-500" : "bg-blue-500"
                      : "bg-muted-foreground"
                  }`}
                  title={`${d.day}: ${d.tags.join(", ")}${hasEpisode ? ` [${d.tier}]` : ""}`}
                />
              );
            })}
          </div>
          <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm inline-block" /> Alert</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-sm inline-block" /> Warning</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-sm inline-block" /> Watch</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-muted-foreground rounded-sm inline-block" /> Tag</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
