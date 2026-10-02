"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
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
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/segmented-control";
import { AXIS_TICK, CHART } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";
import { type HourlyHrPoint, type HrAnomaly, detectHrAnomalies } from "@/lib/hr-anomalies";
import { formatIsoDay, shiftIsoDay } from "@/lib/date-utils";
import { formatNightLabel } from "@/lib/health/format";

interface HourlyHrChartProps {
  data: HourlyHrPoint[];
}

type ViewMode = "night" | "day";

const VIEW_OPTIONS: SegmentedOption<ViewMode>[] = [
  { value: "night", label: "Night" },
  { value: "day", label: "Full Day" },
];

interface HourlyChartPoint {
  day: string;
  hour: number;
  actualHour: number;
  label: string;
  avgBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
  range: [number, number] | null;
  source: string | null;
}

function formatHour(h: number): string {
  const normalized = ((h % 24) + 24) % 24;
  if (normalized === 0) return "12a";
  if (normalized < 12) return `${normalized}a`;
  if (normalized === 12) return "12p";
  return `${normalized - 12}p`;
}

function prevDay(day: string): string {
  return shiftIsoDay(day, -1) ?? day;
}

function toChartPoint(
  point: HourlyHrPoint | undefined,
  day: string,
  hour: number
): HourlyChartPoint {
  const minBpm = point?.minBpm ?? null;
  const maxBpm = point?.maxBpm ?? null;
  return {
    day: point?.day ?? day,
    hour,
    actualHour: ((hour % 24) + 24) % 24,
    label: formatHour(hour),
    avgBpm: point?.avgBpm ?? null,
    minBpm,
    maxBpm,
    range: minBpm != null && maxBpm != null ? [minBpm, maxBpm] : null,
    source: point?.source ?? null,
  };
}

function formatBpm(value: number | null): string {
  return value != null ? `${value} bpm` : "—";
}

function HourlyHrTooltip({
  active,
  payload,
  anomalyByHour,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: HourlyChartPoint }>;
  anomalyByHour: Map<string, HrAnomaly>;
}) {
  const entry = active ? payload?.[0]?.payload : undefined;
  if (!entry) return null;
  const anomaly = anomalyByHour.get(`${entry.day}:${entry.actualHour}`);
  return (
    <ChartTooltipFrame title={`Time: ${formatHour(entry.actualHour)}`}>
      <ChartTooltipRow
        color={CHART.heartRate}
        label="Avg"
        value={formatBpm(entry.avgBpm)}
      />
      <ChartTooltipRow label="Min" value={formatBpm(entry.minBpm)} />
      <ChartTooltipRow label="Max" value={formatBpm(entry.maxBpm)} />
      {entry.source && (
        <p className="text-muted-foreground">Source: {entry.source}</p>
      )}
      {anomaly && (
        <p className="text-attention">
          Unusual vs prior same-hour avg ~{Math.round(anomaly.baseline)} bpm
        </p>
      )}
    </ChartTooltipFrame>
  );
}

export function HourlyHrChart({ data }: HourlyHrChartProps) {
  const availableDays = useMemo(() => {
    const days = new Set(data.map((d) => d.day));
    return [...days].sort();
  }, [data]);

  const [selectedDay, setSelectedDay] = useState(() =>
    availableDays.length > 0 ? availableDays[availableDays.length - 1] : ""
  );
  const [viewMode, setViewMode] = useState<ViewMode>("night");

  const chartData = useMemo((): HourlyChartPoint[] => {
    if (viewMode === "night") {
      const prevDayStr = prevDay(selectedDay);
      const eveningPoints = data.filter((d) => d.day === prevDayStr && d.hour >= 20);
      const morningPoints = data.filter((d) => d.day === selectedDay && d.hour <= 12);

      const byKey = new Map<number, HourlyHrPoint>();
      for (const p of eveningPoints) byKey.set(p.hour - 24, p);
      for (const p of morningPoints) byKey.set(p.hour, p);

      const hours: number[] = [];
      for (let h = -4; h <= 12; h++) hours.push(h);

      return hours.map((h) =>
        toChartPoint(byKey.get(h), h < 0 ? prevDayStr : selectedDay, h)
      );
    }

    const points = data.filter((d) => d.day === selectedDay);
    const byHour = new Map(points.map((p) => [p.hour, p]));
    return Array.from({ length: 24 }, (_, h) =>
      toChartPoint(byHour.get(h), selectedDay, h)
    );
  }, [data, selectedDay, viewMode]);

  const anomalies = useMemo(() => {
    const days =
      viewMode === "night"
        ? [prevDay(selectedDay), selectedDay]
        : [selectedDay];
    const chartKeys = new Set(
      chartData.map((point) => `${point.day}:${point.actualHour}`)
    );
    return days
      .flatMap((day) => detectHrAnomalies(day, data))
      .filter((anomaly) =>
        chartKeys.has(`${anomaly.day}:${anomaly.hour}`)
      );
  }, [selectedDay, data, viewMode, chartData]);

  const anomalyByHour = useMemo(() => {
    const map = new Map<string, HrAnomaly>();
    for (const a of anomalies) {
      const key = `${a.day}:${a.hour}`;
      if (!map.has(key)) map.set(key, a);
    }
    return map;
  }, [anomalies]);

  const canPrev = availableDays.indexOf(selectedDay) > 0;
  const canNext = availableDays.indexOf(selectedDay) < availableDays.length - 1;
  const hasChartHeartRate = chartData.some((point) => point.avgBpm != null);

  if (availableDays.length === 0) return null;

  const isNight = viewMode === "night";
  const periodLabel = isNight
    ? formatNightLabel(selectedDay, { weekday: false })
    : (formatIsoDay(selectedDay) ?? selectedDay);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <CardTitle>Hourly Heart Rate</CardTitle>
          <DayNavigator
            label={<span className="inline-block min-w-32">{periodLabel}</span>}
            onPrevious={() => {
              const idx = availableDays.indexOf(selectedDay);
              if (idx > 0) setSelectedDay(availableDays[idx - 1]);
            }}
            onNext={() => {
              const idx = availableDays.indexOf(selectedDay);
              if (idx < availableDays.length - 1) setSelectedDay(availableDays[idx + 1]);
            }}
            previousDisabled={!canPrev}
            nextDisabled={!canNext}
            previousLabel={isNight ? "Previous night" : "Previous day"}
            nextLabel={isNight ? "Next night" : "Next day"}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SegmentedControl
            label="Hours shown"
            options={VIEW_OPTIONS}
            value={viewMode}
            onValueChange={setViewMode}
          />
          {anomalies.length > 0 && (
            <p className="text-xs text-attention">
              {anomalies.length} unusual hour{anomalies.length === 1 ? "" : "s"}{" "}
              vs prior same-hour pattern
            </p>
          )}
        </div>
        <CardDescription>
          Hourly average and observed min–max band (bpm). Markers compare with
          your prior average for the same local hour; they are not clinical
          alerts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasChartHeartRate ? (
          <EmptyState
            className="min-h-[300px] justify-center"
            title="No hourly heart-rate samples are available for this view."
          />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                interval={isNight ? 1 : 2}
              />
              <YAxis
                tick={AXIS_TICK}
                tickFormatter={(v) => `${v}`}
                domain={["dataMin - 5", "dataMax + 5"]}
                label={{
                  value: "bpm",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 11,
                }}
              />
              <Tooltip
                content={<HourlyHrTooltip anomalyByHour={anomalyByHour} />}
              />
              <Area
                type="monotone"
                dataKey="range"
                name="Min–max"
                fill={CHART.heartRate}
                fillOpacity={0.15}
                stroke="none"
                activeDot={false}
              />
              <Line
                type="monotone"
                dataKey="avgBpm"
                name="Avg"
                stroke={CHART.heartRate}
                strokeWidth={2}
                dot={false}
              />
              {anomalies.map((a) => {
                const point = chartData.find(
                  (d) => d.day === a.day && d.actualHour === a.hour
                );
                if (!point || point.avgBpm == null) return null;
                return (
                  <ReferenceDot
                    key={`anomaly-${a.day}-${a.hour}-${a.type}`}
                    x={point.label}
                    y={point.avgBpm}
                    r={5}
                    fill={CHART.attention}
                    stroke="var(--card)"
                    strokeWidth={1.5}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
