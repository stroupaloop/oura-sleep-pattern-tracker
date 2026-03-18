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

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

export function HourlyHrChart({ data }: HourlyHrChartProps) {
  const availableDays = useMemo(() => {
    const days = new Set(data.map((d) => d.day));
    return [...days].sort();
  }, [data]);

  const [selectedDay, setSelectedDay] = useState(() =>
    availableDays.length > 0 ? availableDays[availableDays.length - 1] : ""
  );

  const dayData = useMemo(() => {
    const points = data.filter((d) => d.day === selectedDay);
    const byHour = new Map(points.map((p) => [p.hour, p]));
    return Array.from({ length: 24 }, (_, h) => {
      const p = byHour.get(h);
      return {
        hour: h,
        label: formatHour(h),
        avgBpm: p?.avgBpm ?? null,
        minBpm: p?.minBpm ?? null,
        maxBpm: p?.maxBpm ?? null,
        source: p?.source ?? null,
      };
    });
  }, [data, selectedDay]);

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
        {anomalies.length > 0 && (
          <p className="text-xs text-red-400 mt-1">
            {anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"} detected
          </p>
        )}
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={dayData}>
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
              labelFormatter={(label, payload) => {
                const entry = payload?.[0]?.payload;
                const anomaly = entry ? anomalyByHour.get(entry.hour) : null;
                const parts = [`Time: ${label}`];
                if (entry?.source) parts.push(`Source: ${entry.source}`);
                if (anomaly) parts.push(anomaly.message);
                return parts.join(" | ");
              }}
            />
            <Area
              type="monotone"
              dataKey="maxBpm"
              fill="oklch(0.65 0.15 15 / 10%)"
              stroke="none"
              connectNulls
            />
            <Area
              type="monotone"
              dataKey="minBpm"
              fill="oklch(0.205 0 0)"
              stroke="none"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="avgBpm"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            {anomalies.map((a) => {
              const point = dayData[a.hour];
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
