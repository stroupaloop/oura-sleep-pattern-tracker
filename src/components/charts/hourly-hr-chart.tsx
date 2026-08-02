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
import { Button } from "@/components/ui/button";
import { type HourlyHrPoint, type HrAnomaly, detectHrAnomalies } from "@/lib/hr-anomalies";
import { shiftIsoDay } from "@/lib/date-utils";

interface HourlyHrChartProps {
  data: HourlyHrPoint[];
}

type ViewMode = "night" | "day";

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

export function HourlyHrChart({ data }: HourlyHrChartProps) {
  const availableDays = useMemo(() => {
    const days = new Set(data.map((d) => d.day));
    return [...days].sort();
  }, [data]);

  const [selectedDay, setSelectedDay] = useState(() =>
    availableDays.length > 0 ? availableDays[availableDays.length - 1] : ""
  );
  const [viewMode, setViewMode] = useState<ViewMode>("night");

  const chartData = useMemo(() => {
    if (viewMode === "night") {
      const prevDayStr = prevDay(selectedDay);
      const eveningPoints = data.filter((d) => d.day === prevDayStr && d.hour >= 20);
      const morningPoints = data.filter((d) => d.day === selectedDay && d.hour <= 12);

      const byKey = new Map<number, HourlyHrPoint>();
      for (const p of eveningPoints) byKey.set(p.hour - 24, p);
      for (const p of morningPoints) byKey.set(p.hour, p);

      const hours: number[] = [];
      for (let h = -4; h <= 12; h++) hours.push(h);

      return hours.map((h) => {
        const p = byKey.get(h);
        return {
          day: p?.day ?? (h < 0 ? prevDayStr : selectedDay),
          hour: h,
          actualHour: ((h % 24) + 24) % 24,
          label: formatHour(h),
          avgBpm: p?.avgBpm ?? null,
          minBpm: p?.minBpm ?? null,
          maxBpm: p?.maxBpm ?? null,
          source: p?.source ?? null,
        };
      });
    }

    const points = data.filter((d) => d.day === selectedDay);
    const byHour = new Map(points.map((p) => [p.hour, p]));
    return Array.from({ length: 24 }, (_, h) => {
      const p = byHour.get(h);
      return {
        day: selectedDay,
        hour: h,
        actualHour: h,
        label: formatHour(h),
        avgBpm: p?.avgBpm ?? null,
        minBpm: p?.minBpm ?? null,
        maxBpm: p?.maxBpm ?? null,
        source: p?.source ?? null,
      };
    });
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

  const nightLabel = `${prevDay(selectedDay).slice(5)} night`;
  const dayLabel = selectedDay.slice(5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Hourly Heart Rate</CardTitle>
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
              {viewMode === "night" ? nightLabel : dayLabel}
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
        <div className="flex items-center gap-2 mt-1">
          <div className="flex gap-1 text-xs">
            <Button
              variant={viewMode === "night" ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setViewMode("night")}
            >
              Night
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "outline"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setViewMode("day")}
            >
              Full Day
            </Button>
          </div>
          {anomalies.length > 0 && (
            <p className="text-xs text-amber-300">
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
          <div className="flex min-h-[300px] items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
            No hourly heart-rate samples are available for this view.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis
              dataKey="label"
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              interval={viewMode === "night" ? 1 : 2}
            />
            <YAxis
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              tickFormatter={(v) => `${v}`}
              domain={["dataMin - 5", "dataMax + 5"]}
              label={{
                value: "bpm",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
                fill: "oklch(0.708 0 0)",
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                borderColor: "oklch(1 0 0 / 10%)",
                borderRadius: "0.5rem",
                color: "oklch(0.985 0 0)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                const labels: Record<string, string> = {
                  avgBpm: "Avg",
                  minBpm: "Min",
                  maxBpm: "Max",
                };
                return [value != null ? `${Number(value)} bpm` : "—", labels[String(name)] ?? name];
              }}
              labelFormatter={(_label, payload) => {
                const entry = payload?.[0]?.payload;
                if (!entry) return "";
                const anomaly = anomalyByHour.get(
                  `${entry.day}:${entry.actualHour}`
                );
                const parts = [`Time: ${formatHour(entry.actualHour)}`];
                if (entry.source) parts.push(`Source: ${entry.source}`);
                if (anomaly) {
                  parts.push(
                    `Unusual vs prior same-hour avg ~${Math.round(
                      anomaly.baseline
                    )} bpm`
                  );
                }
                return parts.join(" | ");
              }}
            />
            <Area
              type="monotone"
              dataKey="maxBpm"
              fill="oklch(0.65 0.08 250 / 12%)"
              stroke="none"
            />
            <Area
              type="monotone"
              dataKey="minBpm"
              fill="oklch(0.205 0 0)"
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="avgBpm"
              stroke="#60a5fa"
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
                  fill={a.severity === "high" ? "#ef4444" : "#f97316"}
                  stroke="none"
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
