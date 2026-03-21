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
  ReferenceLine,
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
  class5min: string;
  nonWearTime: number | null;
}

interface HrOverlay {
  day: string;
  hour: number;
  avgBpm: number | null;
}

interface WearActivityChartProps {
  data: WearActivityDay[];
  hrData?: HrOverlay[];
}

const CLASS_LABELS: Record<number, string> = {
  0: "Non-wear",
  1: "Rest",
  2: "Inactive",
  3: "Low",
  4: "Medium",
  5: "High",
};

const CLASS_COLORS: Record<number, string> = {
  0: "#6b7280",
  1: "#3b82f6",
  2: "#60a5fa",
  3: "#34d399",
  4: "#fbbf24",
  5: "#ef4444",
};

function parseClass5min(data: string): number[] {
  return data.split("").map((c) => {
    const v = parseInt(c, 10);
    return v >= 0 && v <= 5 ? v : -1;
  }).filter((v) => v >= 0);
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

interface ChartPoint {
  hour: number;
  label: string;
  activityClass: number;
  nonWearMinutes: number;
  avgBpm: number | null;
}

export function WearActivityChart({ data, hrData }: WearActivityChartProps) {
  const availableDays = useMemo(() => {
    return [...new Set(data.map((d) => d.day))].sort();
  }, [data]);

  const [selectedDay, setSelectedDay] = useState(() =>
    availableDays.length > 0 ? availableDays[availableDays.length - 1] : ""
  );

  const hrByDayHour = useMemo(() => {
    if (!hrData) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const h of hrData) {
      if (h.avgBpm != null) map.set(`${h.day}|${h.hour}`, h.avgBpm);
    }
    return map;
  }, [hrData]);

  const chartData = useMemo((): ChartPoint[] => {
    const dayData = data.find((d) => d.day === selectedDay);
    if (!dayData?.class5min) return [];

    const classes = parseClass5min(dayData.class5min);
    const intervalsPerHour = Math.ceil(classes.length / 24);

    return Array.from({ length: 24 }, (_, h) => {
      const start = h * intervalsPerHour;
      const end = Math.min(start + intervalsPerHour, classes.length);
      const hourClasses = classes.slice(start, end);

      const nonWearCount = hourClasses.filter((c) => c === 0).length;
      const nonWearMinutes = nonWearCount * 5;

      const activeClasses = hourClasses.filter((c) => c > 0);
      const dominantClass = activeClasses.length > 0
        ? Math.round(activeClasses.reduce((a, b) => a + b, 0) / activeClasses.length)
        : 0;

      return {
        hour: h,
        label: formatHour(h),
        activityClass: hourClasses.length === 0 ? 0 : dominantClass,
        nonWearMinutes,
        avgBpm: hrByDayHour.get(`${selectedDay}|${h}`) ?? null,
      };
    });
  }, [data, selectedDay, hrByDayHour]);

  const totalNonWear = useMemo(() => {
    const dayData = data.find((d) => d.day === selectedDay);
    if (dayData?.nonWearTime != null) return Math.round(dayData.nonWearTime / 60);
    return chartData.reduce((sum, p) => sum + p.nonWearMinutes, 0);
  }, [data, selectedDay, chartData]);

  const nonWearHours = useMemo(() => {
    return chartData
      .filter((p) => p.nonWearMinutes >= 30)
      .map((p) => p.label);
  }, [chartData]);

  const canPrev = availableDays.indexOf(selectedDay) > 0;
  const canNext = availableDays.indexOf(selectedDay) < availableDays.length - 1;

  if (availableDays.length === 0) return null;

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
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <div className="flex gap-2 text-xs flex-wrap">
            {[0, 1, 3, 4, 5].map((c) => (
              <span key={c} className="flex items-center gap-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: CLASS_COLORS[c] }}
                />
                {CLASS_LABELS[c]}
              </span>
            ))}
          </div>
          {totalNonWear > 0 && (
            <p className="text-xs text-muted-foreground">
              {Math.floor(totalNonWear / 60)}h {totalNonWear % 60}m non-wear
              {nonWearHours.length > 0 && (
                <span className="text-gray-400"> ({nonWearHours.join(", ")})</span>
              )}
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
              yAxisId="activity"
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              domain={[0, 5]}
              ticks={[0, 1, 2, 3, 4, 5]}
              tickFormatter={(v) => CLASS_LABELS[v as number]?.slice(0, 3) ?? ""}
              width={40}
            />
            <YAxis
              yAxisId="hr"
              orientation="right"
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              domain={["dataMin - 5", "dataMax + 10"]}
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
              formatter={(value: any, name: any) => {
                if (name === "avgBpm") return [value != null ? `${Number(value)} bpm` : "—", "Heart Rate"];
                if (name === "activityClass") return [CLASS_LABELS[value as number] ?? value, "Activity"];
                if (name === "nonWearMinutes") return [`${value} min`, "Non-wear"];
                return [value, name];
              }}
            />
            <ReferenceLine yAxisId="activity" y={0} stroke="none" />
            <Bar
              yAxisId="activity"
              dataKey="activityClass"
              radius={[2, 2, 0, 0]}
              maxBarSize={20}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={CLASS_COLORS[entry.activityClass] ?? "#6b7280"}
                  fillOpacity={entry.nonWearMinutes >= 30 ? 0.3 : 0.8}
                />
              ))}
            </Bar>
            <Line
              yAxisId="hr"
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
