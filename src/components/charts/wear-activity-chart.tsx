"use client";

import { useId, useState, useMemo } from "react";
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
import { DayNavigator } from "@/components/ui/day-navigator";
import { EmptyState } from "@/components/ui/empty-state";
import { AXIS_TICK } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";
import { formatIsoDay, shiftIsoDay } from "@/lib/date-utils";
import type { ProjectedActivityDay } from "@/lib/oura/activity";
import {
  ACTIVITY_COLORS,
  ACTIVITY_LABELS,
  HEART_RATE_LINE_COLOR,
  NONWEAR_COLOR,
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
  /** The earliest day offered; every day from it to today can be chosen. */
  firstDay: string;
}

const LEGEND_CLASSES: ActivityClass[] = ["rest", "inactive", "low", "medium", "high"];

const NONWEAR_HATCH =
  "repeating-linear-gradient(135deg, var(--faint-foreground) 0 1px, transparent 1px 4px)";

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

function WearActivityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ChartPoint }>;
}) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <ChartTooltipFrame title={`${formatHour(d.hour)} ET`}>
      {d.avgBpm != null ? (
        <ChartTooltipRow
          color={HEART_RATE_LINE_COLOR}
          label="HR"
          value={`${d.avgBpm} bpm`}
        />
      ) : (
        <p className="text-muted-foreground">No heart-rate sample</p>
      )}
      {d.isNonWear && (
        <p className="text-muted-foreground">
          Oura code 0 dominated this hour ·{" "}
          {formatMinutes(d.nonWearMinutes)} explicit non-wear
        </p>
      )}
      {d.activityClass && (
        <ChartTooltipRow
          color={ACTIVITY_COLORS[d.activityClass]}
          label={`Dominant among ${formatMinutes(d.classifiedMinutes)} classified`}
          value={ACTIVITY_LABELS[d.activityClass]}
        />
      )}
      {!d.isNonWear && !d.activityClass && (
        <p className="text-muted-foreground">
          {d.classifiedMinutes > 0
            ? "Mixed or partial Oura activity classification"
            : "No Oura activity classification"}
        </p>
      )}
      {d.classifiedMinutes > 0 && (
        <p className="text-muted-foreground">
          {formatMinutes(d.classifiedMinutes)} of this hour classified
        </p>
      )}
    </ChartTooltipFrame>
  );
}

export function WearActivityChart({
  activityData,
  hrData,
  currentDay,
  firstDay,
}: WearActivityChartProps) {
  const hatchId = `nonwear-hatch-${useId().replace(/[^\w-]/g, "")}`;
  const availableDays = useMemo(() => {
    const days = new Set<string>();
    for (const h of hrData) if (h.day >= firstDay) days.add(h.day);
    for (const a of activityData) if (a.day >= firstDay) days.add(a.day);
    return [...days].sort();
  }, [hrData, activityData, firstDay]);

  const selectableDays = useMemo(() => {
    const calendarWindow: string[] = [];
    for (
      let day: string | null = firstDay;
      day != null && day <= currentDay;
      day = shiftIsoDay(day, 1)
    ) {
      calendarWindow.push(day);
    }
    return [...new Set([...availableDays, ...calendarWindow])].sort();
  }, [availableDays, currentDay, firstDay]);

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
  const selectedDayLabel = formatIsoDay(selectedDay) ?? selectedDay;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Ring Wear & Activity</CardTitle>
          <DayNavigator
            className="self-end sm:self-auto"
            label={
              <span className="inline-block min-w-36">
                {selectedDayLabel} · ET
              </span>
            }
            onPrevious={() => {
              const idx = selectableDays.indexOf(selectedDay);
              if (idx > 0) setSelectedDay(selectableDays[idx - 1]);
            }}
            onNext={() => {
              const idx = selectableDays.indexOf(selectedDay);
              if (idx < selectableDays.length - 1) {
                setSelectedDay(selectableDays[idx + 1]);
              }
            }}
            previousDisabled={!canPrev}
            nextDisabled={!canNext}
            previousLabel="Previous ET calendar day"
            nextLabel="Next ET calendar day"
          />
        </div>
        <CardDescription>
          Hourly average heart rate with Oura activity classification. Faded
          bars indicate partial hourly coverage.
        </CardDescription>
        <div className="mt-1 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {LEGEND_CLASSES.map((activityClass) => (
              <span key={activityClass} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-sm"
                  style={{ backgroundColor: ACTIVITY_COLORS[activityClass] }}
                />
                {ACTIVITY_LABELS[activityClass]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-sm bg-faint-foreground/30 ring-1 ring-inset ring-border"
              />
              Mixed or unavailable
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-sm border border-dashed border-faint-foreground bg-muted"
                style={{ backgroundImage: NONWEAR_HATCH }}
              />
              Mostly non-wear (Oura code 0)
            </span>
          </div>
          {classifiedMinutes > 0 ? (
            <p className="text-muted-foreground tabular-nums">
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
            <p className="text-muted-foreground tabular-nums">
              Movement: {activitySummary.join(" · ")}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasSelectedDayData ? (
          <EmptyState
            className="min-h-[300px] justify-center"
            title={`No hourly heart-rate or Oura activity data for ${selectedDayLabel} ET`}
          >
            {canPrev
              ? "Use the previous-day control to review historical data."
              : null}
          </EmptyState>
        ) : (
          <div
            role="img"
            aria-label={`Hourly heart rate and dominant Oura activity for ${selectedDayLabel} in Eastern Time`}
          >
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData}>
                <defs>
                  <pattern
                    id={hatchId}
                    width={6}
                    height={6}
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width={6} height={6} fill={NONWEAR_COLOR} />
                    <line
                      x1={0}
                      y1={0}
                      x2={0}
                      y2={6}
                      stroke="var(--faint-foreground)"
                      strokeOpacity={0.5}
                    />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={AXIS_TICK} interval={2} />
                <YAxis
                  tick={AXIS_TICK}
                  domain={[minBpm, maxBpm]}
                  tickFormatter={(v) => `${v}`}
                  width={40}
                />
                <Tooltip content={<WearActivityTooltip />} />
                {nonWearGaps.map((gap, i) => (
                  <ReferenceArea
                    key={i}
                    x1={formatHour(gap.start)}
                    x2={formatHour(gap.end)}
                    fill={`url(#${hatchId})`}
                    fillOpacity={1}
                    stroke="var(--faint-foreground)"
                    strokeOpacity={0.5}
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
