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
  ReferenceDot,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatIsoDay } from "@/lib/date-utils";
import type {
  OuraActivityCode,
  ProjectedActivityDay,
} from "@/lib/oura/activity";

export type WearActivityDay = ProjectedActivityDay;

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

type ActivityClass = "rest" | "inactive" | "low" | "medium" | "high";

const ACTIVITY_LABELS: Record<ActivityClass, string> = {
  rest: "Resting",
  inactive: "Inactive",
  low: "Low",
  medium: "Medium",
  high: "High",
};

const ACTIVITY_COLORS: Record<ActivityClass, string> = {
  rest: "#3b82f6",
  inactive: "#60a5fa",
  low: "#34d399",
  medium: "#f59e0b",
  high: "#ef4444",
};

const NONWEAR_COLOR = "#6b7280";
const HEART_RATE_BAR_COLOR = "#f87171";
const OURA_ACTIVITY_CLASSES: Partial<Record<OuraActivityCode, ActivityClass>> = {
  1: "rest",
  2: "inactive",
  3: "low",
  4: "medium",
  5: "high",
};

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

function formatMinutes(mins: number): string {
  const roundedMinutes = Math.max(0, Math.round(mins));
  const h = Math.floor(roundedMinutes / 60);
  const m = roundedMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface ChartPoint {
  hour: number;
  label: string;
  avgBpm: number | null;
  source: string | null;
  activityClass: ActivityClass | null;
  isNonWear: boolean;
  classifiedMinutes: number;
  nonWearMinutes: number;
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

  const chartData = useMemo((): ChartPoint[] => {
    return Array.from({ length: 24 }, (_, h) => {
      const hr = hrByHour.get(`${h}`);
      const activityHour = dayActivity?.hours[h] ?? null;
      const activityCode = activityHour?.dominantCode ?? null;

      return {
        hour: h,
        label: formatHour(h),
        avgBpm: hr?.avgBpm ?? null,
        source: hr?.source ?? null,
        activityClass:
          activityCode != null
            ? OURA_ACTIVITY_CLASSES[activityCode] ?? null
            : null,
        isNonWear: activityCode === 0,
        classifiedMinutes: activityHour?.classifiedMinutes ?? 0,
        nonWearMinutes: activityHour?.nonWearMinutes ?? 0,
      };
    });
  }, [hrByHour, dayActivity]);

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

  const totalNonWearMinutes = dayActivity?.nonWearMinutes ?? 0;
  const classifiedMinutes = dayActivity?.classifiedMinutes ?? 0;

  const activitySummary = useMemo(() => {
    if (!dayActivity) return null;
    const parts: string[] = [];
    if (dayActivity.highActivityMinutes > 0)
      parts.push(`High: ${formatMinutes(dayActivity.highActivityMinutes)}`);
    if (dayActivity.mediumActivityMinutes > 0)
      parts.push(`Med: ${formatMinutes(dayActivity.mediumActivityMinutes)}`);
    if (dayActivity.lowActivityMinutes > 0)
      parts.push(`Low: ${formatMinutes(dayActivity.lowActivityMinutes)}`);
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
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Ring Wear & Activity</CardTitle>
          <div className="flex items-center gap-2 self-end text-sm sm:self-auto">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11"
              disabled={!canPrev}
              aria-label="Previous ET calendar day"
              onClick={() => {
                const idx = availableDays.indexOf(selectedDay);
                if (idx > 0) setSelectedDay(availableDays[idx - 1]);
              }}
            >
              &lt;
            </Button>
            <span className="font-mono text-muted-foreground min-w-[150px] text-center">
              {formatIsoDay(selectedDay) ?? selectedDay} · ET
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11"
              disabled={!canNext}
              aria-label="Next ET calendar day"
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
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 border-t-2 border-red-400" />
              Heart rate
            </span>
            {(
              ["rest", "inactive", "low", "medium", "high"] as ActivityClass[]
            ).map((activityClass) => (
              <span key={activityClass} className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: ACTIVITY_COLORS[activityClass] }}
                />
                {ACTIVITY_LABELS[activityClass]}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-sm border border-dashed border-gray-500 bg-gray-500/15" />
              Non-wear (Oura code 0)
            </span>
          </div>
          {classifiedMinutes > 0 ? (
            <p className="text-muted-foreground">
              Oura activity detail: {formatMinutes(classifiedMinutes)}
              {totalNonWearMinutes > 0 &&
                ` · Non-wear: ${formatMinutes(totalNonWearMinutes)}`}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Oura activity classification unavailable for this ET day
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
                    <p className="font-medium">{formatHour(d.hour)} ET</p>
                    {d.avgBpm != null ? (
                      <p>HR: {d.avgBpm} bpm</p>
                    ) : (
                      <p className="text-gray-400">No heart-rate sample</p>
                    )}
                    {d.isNonWear && (
                      <p className="text-gray-400">
                        Oura non-wear: {formatMinutes(d.nonWearMinutes)}
                      </p>
                    )}
                    {d.activityClass && (
                      <p
                        style={{
                          color: ACTIVITY_COLORS[d.activityClass],
                        }}
                      >
                        Dominant Oura activity:{" "}
                        {ACTIVITY_LABELS[d.activityClass]}
                      </p>
                    )}
                    {!d.isNonWear &&
                      !d.activityClass &&
                      (d.classifiedMinutes > 0 ? (
                        <p className="text-gray-400">
                          Mixed or partial Oura activity classification
                        </p>
                      ) : (
                        <p className="text-gray-400">
                          No Oura activity classification
                        </p>
                      ))}
                    {d.classifiedMinutes > 0 && (
                      <p className="text-gray-400">
                        {formatMinutes(d.classifiedMinutes)} classified in this hour
                      </p>
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
            {chartData
              .filter((point) => point.activityClass != null)
              .map((point) => (
                <ReferenceDot
                  key={`activity-${point.hour}`}
                  x={point.label}
                  y={minBpm + 1}
                  r={4}
                  fill={ACTIVITY_COLORS[point.activityClass!]}
                  stroke="none"
                />
            ))}
            <Bar dataKey="avgBpm" radius={[2, 2, 0, 0]} maxBarSize={16}>
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={HEART_RATE_BAR_COLOR}
                  fillOpacity={0.25}
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
