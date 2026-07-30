"use client";

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computeCalendarRollingAverage } from "@/lib/dashboard-metrics";

interface HrPoint {
  day: string;
  restingBpm: number | null;
  awakeBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
}

interface RestingHrChartProps {
  data: HrPoint[];
}

export function RestingHrChart({ data }: RestingHrChartProps) {
  const filtered = data.filter((d) => d.restingBpm != null || d.awakeBpm != null);
  const rollingAverages = computeCalendarRollingAverage(
    filtered.map((point) => ({
      day: point.day,
      value:
        point.restingBpm != null && point.restingBpm > 0
          ? point.restingBpm
          : null,
    })),
    7
  );

  const withRolling = filtered.map((point, i) => {
    return {
      ...point,
      rollingAvg:
        rollingAverages[i] != null
          ? Math.round(rollingAverages[i]! * 10) / 10
          : null,
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rest-Labelled Heart Rate</CardTitle>
        <CardDescription>
          App-derived hourly averages from Oura samples labelled rest
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={withRolling}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis
              dataKey="day"
              tickFormatter={(d) => d.slice(5)}
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              interval="preserveStartEnd"
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
                  restingBpm: "Resting",
                  awakeBpm: "Awake",
                  rollingAvg: "7-day Avg",
                  minBpm: "Min",
                };
                return [`${Number(value)} bpm`, labels[String(name)] ?? name];
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="minBpm"
              fill="oklch(0.65 0.15 15 / 10%)"
              stroke="none"
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="restingBpm"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="rollingAvg"
              stroke="#f87171"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="awakeBpm"
              stroke="oklch(0.708 0 0)"
              strokeWidth={1}
              dot={false}
              connectNulls={false}
              opacity={0.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
