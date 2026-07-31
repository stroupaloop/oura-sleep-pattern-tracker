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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatIsoDay, shiftIsoDay } from "@/lib/date-utils";
import type { ProjectedActivityDay } from "@/lib/oura/activity";
import {
  ACTIVITY_COLORS,
  ACTIVITY_LABELS,
  HEART_RATE_LINE_COLOR,
  NONWEAR_COLOR,
  UNAVAILABLE_ACTIVITY_COLOR,
  getActivityBarPresentation,
  type ActivityClass,
} from "@/lib/oura/activity-presentation";

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
  currentDay: string;
}

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
  barFill: string;
  barFillOpacity: number;
}

export function WearActivityChart({
  activityData,
  hrData,
  currentDay,
}: WearActivityChartProps) {
  const availableDays = useMemo(() => {
    const days = new Set<string>();
    for (const h of hrData) days.add(h.day);
    for (const a of activityData) days.add(a.day);
    return [...days].sort();
  }, [hrData, activityData]);

  const selectableDays = useMemo(() => {
    const calendarWindow = Array.from({ length: 14 }, (_, index) =>
      shiftIsoDay(currentDay, index - 13)
    ).filter((day): day is string => day != null);
    return [...new Set([...availableDays, ...calendarWindow])].sort();
  }, [availableDays, currentDay]);

  const [selectedDay, setSelectedDay] = useState(currentDay);

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
      const classifiedMinutes = activityHour?.classifiedMinutes ?? 0;
      const presentation = getActivityBarPresentation(
        activityCode,
        classifiedMinutes
      );

      return {
        hour: h,
        label: formatHour(h),
        avgBpm: hr?.avgBpm ?? null,
        source: hr?.source ?? null,
        activityClass: presentation.activityClass,
        isNonWear: presentation.isNonWear,
        classifiedMinutes,
        nonWearMinutes: activityHour?.nonWearMinutes ?? 0,
        barFill: presentation.fill,
        barFillOpacity: presentation.fillOpacity,
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
  const wornMinutes = Math.max(0, classifiedMinutes - totalNonWearMinutes);

  const activitySummary = useMemo(() => {
    if (!dayActivity) return null;
    const parts: string[] = [];
    if (dayActivity.highActivityMinutes > 0)
      parts.push(`High: ${formatMinutes(dayActivity.highActivityMinutes)}`);
    if (dayActivity.mediumActivityMinutes > 0)
      parts.push(`Medium: ${formatMinutes(dayActivity.mediumActivityMinutes)}`);
    if (dayActivity.lowActivityMinutes > 0)
      parts.push(`Low: ${formatMinutes(dayActivity.lowActivityMinutes)}`);
    return parts.length > 0 ? parts : null;
  }, [dayActivity]);

  const selectedDayIndex = selectableDays.indexOf(selectedDay);
  const canPrev = selectedDayIndex > 0;
  const canNext =
    selectedDayIndex >= 0 && selectedDayIndex < selectableDays.length - 1;

  if (availableDays.length === 0) return null;

  const bpmValues = chartData.filter((d) => d.avgBpm != null).map((d) => d.avgBpm!);
  const minBpm =
    bpmValues.length > 0
      ? Math.max(0, Math.floor((Math.min(...bpmValues) - 5) / 5) * 5)
      : 40;
  const maxBpm =
    bpmValues.length > 0
      ? Math.ceil((Math.max(...bpmValues) + 10) / 5) * 5
      : 120;
  const hasSelectedDayData = dayActivity != null || hrByHour.size > 0;

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
                const idx = selectableDays.indexOf(selectedDay);
                if (idx > 0) setSelectedDay(selectableDays[idx - 1]);
              }}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <span className="min-w-[150px] text-center text-muted-foreground tabular-nums">
              {formatIsoDay(selectedDay) ?? selectedDay} · ET
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 min-w-11"
              disabled={!canNext}
              aria-label="Next ET calendar day"
              onClick={() => {
                const idx = selectableDays.indexOf(selectedDay);
                if (idx < selectableDays.length - 1) {
                  setSelectedDay(selectableDays[idx + 1]);
                }
              }}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <CardDescription>
          Bars show hourly average heart rate; the line connects available
          hours. Color shows dominant Oura activity; faded color means partial
          coverage.
        </CardDescription>
        <div className="mt-1 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
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
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: UNAVAILABLE_ACTIVITY_COLOR }}
              />
              Mixed or unavailable
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-gray-500 bg-gray-500/15" />
              Mostly non-wear (Oura code 0)
            </span>
          </div>
          {classifiedMinutes > 0 ? (
            <p className="text-muted-foreground">
              Oura classification coverage: {formatMinutes(classifiedMinutes)}
              {" · "}Worn: {formatMinutes(wornMinutes)}
              {totalNonWearMinutes > 0 &&
                ` · Explicit non-wear: ${formatMinutes(totalNonWearMinutes)}`}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Oura activity classification unavailable for this ET day
            </p>
          )}
          {activitySummary && (
            <p className="text-muted-foreground">
              Movement: {activitySummary.join(" · ")}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasSelectedDayData ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-md border border-dashed border-border px-4 text-center">
            <div className="max-w-md space-y-1">
              <p className="text-sm font-medium">
                No hourly heart-rate or Oura activity data for{" "}
                {formatIsoDay(selectedDay) ?? selectedDay} ET
              </p>
              {canPrev && (
                <p className="text-sm text-muted-foreground">
                  Use the previous-day control to review historical data.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div
            role="img"
            aria-label={`Hourly heart rate and dominant Oura activity for ${
              formatIsoDay(selectedDay) ?? selectedDay
            } in Eastern Time`}
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis
              dataKey="label"
              fontSize={12}
              tick={{ fill: "oklch(0.708 0 0)" }}
              interval={2}
            />
            <YAxis
              fontSize={12}
              tick={{ fill: "oklch(0.708 0 0)" }}
              domain={[minBpm, maxBpm]}
              tickFormatter={(v) => `${v}`}
              width={40}
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
                        Oura code 0 dominated this hour ·{" "}
                        {formatMinutes(d.nonWearMinutes)} explicit non-wear
                      </p>
                    )}
                    {d.activityClass && (
                      <p
                        style={{
                          color: ACTIVITY_COLORS[d.activityClass],
                        }}
                      >
                        Dominant among{" "}
                        {formatMinutes(d.classifiedMinutes)} classified:{" "}
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
                        {formatMinutes(d.classifiedMinutes)} of this hour
                        classified
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
            <Bar dataKey="avgBpm" radius={[2, 2, 0, 0]} maxBarSize={16}>
              {chartData.map((point, i) => (
                <Cell
                  key={i}
                  fill={point.barFill}
                  fillOpacity={point.barFillOpacity}
                />
              ))}
            </Bar>
            <Line
              type="linear"
              dataKey="avgBpm"
              stroke={HEART_RATE_LINE_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
