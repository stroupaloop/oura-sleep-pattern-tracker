"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceArea,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface WearActivityDay {
  day: string;
  class5min: string | null;
  nonWearTime: number | null;
  highActivityTime: number | null;
  mediumActivityTime: number | null;
  lowActivityTime: number | null;
  sedentaryTime: number | null;
  restingTime: number | null;
}

interface HrOverlay {
  day: string;
  hour: number;
  avgBpm: number | null;
  source: string | null;
}

interface WearActivityChartProps {
  activityData: WearActivityDay[];
  hrData: HrOverlay[];
}

type IntensityZone = "rest" | "light" | "moderate" | "vigorous" | "peak";

const ZONE_LABELS: Record<IntensityZone, string> = {
  rest: "Resting",
  light: "Light",
  moderate: "Moderate",
  vigorous: "Vigorous",
  peak: "Peak",
};

const ZONE_COLORS: Record<IntensityZone, string> = {
  rest: "#3b82f6",
  light: "#60a5fa",
  moderate: "#34d399",
  vigorous: "#f59e0b",
  peak: "#ef4444",
};

const NONWEAR_COLOR = "#6b7280";

function getIntensityZone(avgBpm: number, restingBpm: number): IntensityZone {
  if (avgBpm <= restingBpm * 1.1) return "rest";
  if (avgBpm <= restingBpm * 1.3) return "light";
  if (avgBpm <= restingBpm * 1.6) return "moderate";
  if (avgBpm <= restingBpm * 1.85) return "vigorous";
  return "peak";
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface ChartPoint {
  hour: number;
  label: string;
  avgBpm: number | null;
  source: string | null;
  zone: IntensityZone | null;
  barValue: number;
  isNonWear: boolean;
}

export function WearActivityChart({ activityData, hrData }: WearActivityChartProps) {
  const availableDays = useMemo(() => {
    const days = new Set<string>();
    for (const h of hrData) days.add(h.day);
    for (const a of activityData) days.add(a.day);
    return [...days].sort();
  }, [hrData, activityData]);

  const [selectedDay, setSelectedDay] = useState(() =>
    availableDays.length > 0 ? availableDays[availableDays.length - 1] : ""
  );

  const hrByHour = useMemo(() => {
    const map = new Map<string, HrOverlay>();
    for (const h of hrData) {
      if (h.day === selectedDay) map.set(`${h.hour}`, h);
    }
    return map;
  }, [hrData, selectedDay]);

  const dayActivity = useMemo(
    () => activityData.find((a) => a.day === selectedDay) ?? null,
    [activityData, selectedDay]
  );

  const class5minParsed = useMemo(() => {
    if (!dayActivity?.class5min) return null;
    const chars = dayActivity.class5min.split("");
    const values = chars.map((c) => {
      const v = parseInt(c, 10);
      return v >= 0 && v <= 5 ? v : -1;
    });
    return values;
  }, [dayActivity]);

  const restingBpm = useMemo(() => {
    const restHrs = hrData.filter((h) => h.day === selectedDay && h.source === "rest" && h.avgBpm != null);
    if (restHrs.length > 0) {
      return Math.min(...restHrs.map((h) => h.avgBpm!));
    }
    const allHrs = hrData.filter((h) => h.day === selectedDay && h.avgBpm != null);
    if (allHrs.length > 0) {
      const sorted = allHrs.map((h) => h.avgBpm!).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.25)];
    }
    return 60;
  }, [hrData, selectedDay]);

  const chartData = useMemo((): ChartPoint[] => {
    return Array.from({ length: 24 }, (_, h) => {
      const hr = hrByHour.get(`${h}`);
      const hasHr = hr != null && hr.avgBpm != null;

      let isNonWear = !hasHr;

      if (class5minParsed) {
        const intervalsPerHour = Math.ceil(class5minParsed.length / 24);
        const start = h * intervalsPerHour;
        const end = Math.min(start + intervalsPerHour, class5minParsed.length);
        const hourSlice = class5minParsed.slice(start, end).filter((v) => v >= 0);
        const nonWearCount = hourSlice.filter((v) => v === 0).length;
        if (hourSlice.length > 0 && nonWearCount > hourSlice.length / 2) {
          isNonWear = true;
        }
      }

      const zone = hasHr && !isNonWear ? getIntensityZone(hr.avgBpm!, restingBpm) : null;

      return {
        hour: h,
        label: formatHour(h),
        avgBpm: hr?.avgBpm ?? null,
        source: hr?.source ?? null,
        zone,
        barValue: hasHr ? (hr.avgBpm ?? 0) : 1,
        isNonWear,
      };
    });
  }, [hrByHour, class5minParsed, restingBpm]);

  const nonWearGaps = useMemo(() => {
    const gaps: { start: number; end: number }[] = [];
    let gapStart: number | null = null;
    for (const p of chartData) {
      if (p.isNonWear) {
        if (gapStart === null) gapStart = p.hour;
      } else {
        if (gapStart !== null) {
          gaps.push({ start: gapStart, end: p.hour - 1 });
          gapStart = null;
        }
      }
    }
    if (gapStart !== null) gaps.push({ start: gapStart, end: 23 });
    return gaps;
  }, [chartData]);

  const totalNonWearMin = useMemo(() => {
    if (dayActivity?.nonWearTime != null) return Math.round(dayActivity.nonWearTime / 60);
    return chartData.filter((p) => p.isNonWear).length * 60;
  }, [dayActivity, chartData]);

  const activitySummary = useMemo(() => {
    if (!dayActivity) return null;
    const parts: string[] = [];
    if (dayActivity.highActivityTime)
      parts.push(`High: ${formatMinutes(dayActivity.highActivityTime)}`);
    if (dayActivity.mediumActivityTime)
      parts.push(`Med: ${formatMinutes(dayActivity.mediumActivityTime)}`);
    if (dayActivity.lowActivityTime)
      parts.push(`Low: ${formatMinutes(dayActivity.lowActivityTime)}`);
    return parts.length > 0 ? parts : null;
  }, [dayActivity]);

  const canPrev = availableDays.indexOf(selectedDay) > 0;
  const canNext = availableDays.indexOf(selectedDay) < availableDays.length - 1;

  if (availableDays.length === 0) return null;

  const bpmValues = chartData.filter((d) => d.avgBpm != null).map((d) => d.avgBpm!);
  const minBpm = bpmValues.length > 0 ? Math.min(...bpmValues) - 5 : 40;
  const maxBpm = bpmValues.length > 0 ? Math.max(...bpmValues) + 10 : 120;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ring Wear & Activity</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canPrev}
              onClick={() => {
                const idx = availableDays.indexOf(selectedDay);
                if (idx > 0) setSelectedDay(availableDays[idx - 1]);
              }}
            >
              &lt;
            </Button>
            <span className="font-mono text-muted-foreground min-w-[90px] text-center">
              {selectedDay.slice(5)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canNext}
              onClick={() => {
                const idx = availableDays.indexOf(selectedDay);
                if (idx < availableDays.length - 1) setSelectedDay(availableDays[idx + 1]);
              }}
            >
              &gt;
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
          <div className="flex gap-2 flex-wrap">
            {(["rest", "light", "moderate", "vigorous", "peak"] as IntensityZone[]).map((zone) => (
              <span key={zone} className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: ZONE_COLORS[zone] }}
                />
                {ZONE_LABELS[zone]}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-gray-500 opacity-30" />
              Non-wear
            </span>
          </div>
          {totalNonWearMin > 0 && (
            <p className="text-muted-foreground">
              {formatMinutes(totalNonWearMin)} off-wrist
            </p>
          )}
          {activitySummary && (
            <p className="text-muted-foreground">
              {activitySummary.join(" · ")}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis
              dataKey="label"
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              interval={2}
            />
            <YAxis
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              domain={[minBpm, maxBpm]}
              tickFormatter={(v) => `${v}`}
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                borderColor: "oklch(1 0 0 / 10%)",
                borderRadius: "0.5rem",
                color: "oklch(0.985 0 0)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              content={({ active, payload }: any) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload as ChartPoint;
                return (
                  <div className="rounded-lg border border-white/10 bg-[oklch(0.205_0_0)] px-3 py-2 text-sm text-[oklch(0.985_0_0)]">
                    <p className="font-medium">{formatHour(d.hour)}</p>
                    {d.isNonWear ? (
                      <p className="text-gray-400">Ring not worn</p>
                    ) : (
                      <>
                        {d.avgBpm != null && <p>HR: {d.avgBpm} bpm</p>}
                        {d.zone && (
                          <p style={{ color: ZONE_COLORS[d.zone] }}>
                            {ZONE_LABELS[d.zone]}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              }}
            />
            {nonWearGaps.map((gap, i) => (
              <ReferenceArea
                key={i}
                x1={formatHour(gap.start)}
                x2={formatHour(gap.end)}
                fill={NONWEAR_COLOR}
                fillOpacity={0.15}
                stroke={NONWEAR_COLOR}
                strokeOpacity={0.3}
                strokeDasharray="4 4"
              />
            ))}
            <Bar dataKey="avgBpm" radius={[2, 2, 0, 0]} maxBarSize={16}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.isNonWear
                      ? NONWEAR_COLOR
                      : ZONE_COLORS[entry.zone ?? "rest"]
                  }
                  fillOpacity={entry.isNonWear ? 0.15 : 0.7}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="avgBpm"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
