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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type HourlyHrPoint, type HrAnomaly, detectHrAnomalies } from "@/lib/hr-anomalies";

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
  const d = new Date(day + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
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
          hour: h,
          actualHour: ((h % 24) + 24) % 24,
          label: formatHour(h),
          avgBpm: p?.avgBpm ?? null,
          minBpm: p?.minBpm ?? null,
          maxBpm: p?.maxBpm ?? null,
          source: p?.source ?? null,
          hasData: p != null,
        };
      });
    }

    const points = data.filter((d) => d.day === selectedDay);
    const byHour = new Map(points.map((p) => [p.hour, p]));
    return Array.from({ length: 24 }, (_, h) => {
      const p = byHour.get(h);
      return {
        hour: h,
        actualHour: h,
        label: formatHour(h),
        avgBpm: p?.avgBpm ?? null,
        minBpm: p?.minBpm ?? null,
        maxBpm: p?.maxBpm ?? null,
        source: p?.source ?? null,
        hasData: p != null,
      };
    });
  }, [data, selectedDay, viewMode]);

  const filteredData = useMemo(
    () => chartData.filter((d) => d.hasData),
    [chartData]
  );

  const anomalies = useMemo(
    () => detectHrAnomalies(selectedDay, data),
    [selectedDay, data]
  );

  const anomalyByHour = useMemo(() => {
    const map = new Map<number, HrAnomaly>();
    for (const a of anomalies) {
      if (!map.has(a.hour)) map.set(a.hour, a);
    }
    return map;
  }, [anomalies]);

  const canPrev = availableDays.indexOf(selectedDay) > 0;
  const canNext = availableDays.indexOf(selectedDay) < availableDays.length - 1;

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
            <p className="text-xs text-red-400">
              {anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"} detected
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={filteredData}>
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
                const anomaly = anomalyByHour.get(entry.actualHour);
                const parts = [`Time: ${formatHour(entry.actualHour)}`];
                if (entry.source) parts.push(`Source: ${entry.source}`);
                if (anomaly) parts.push(anomaly.message);
                return parts.join(" | ");
              }}
            />
            <Area
              type="monotone"
              dataKey="maxBpm"
              fill="oklch(0.65 0.15 15 / 10%)"
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
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
            />
            {anomalies.map((a) => {
              const point = filteredData.find((d) => d.actualHour === a.hour);
              if (!point || point.avgBpm == null) return null;
              return (
                <ReferenceDot
                  key={`anomaly-${a.hour}-${a.type}`}
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
      </CardContent>
    </Card>
  );
}
