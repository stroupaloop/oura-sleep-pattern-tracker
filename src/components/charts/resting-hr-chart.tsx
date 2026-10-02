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
  Legend,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AXIS_TICK, CHART, legendLabel } from "./chart-theme";
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

  if (filtered.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Heart Rate During Oura-Labelled Rest</CardTitle>
          <CardDescription>
            App-derived daily averages of Oura samples labelled rest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            className="min-h-48 justify-center"
            title="No Oura-labelled rest or awake heart-rate averages are available for this range."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Heart Rate During Oura-Labelled Rest</CardTitle>
        <CardDescription>
          App-derived daily averages of Oura samples labelled rest. This is
          not Oura&apos;s nightly resting-heart-rate metric.
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          Unit: bpm · trend: 7-day average · compare with your own history; no
          universal range is applied
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={withRolling}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickFormatter={(d) => d.slice(5)}
              tick={AXIS_TICK}
              interval="preserveStartEnd"
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
            <Legend formatter={legendLabel} />
            <Area
              type="monotone"
              dataKey="minBpm"
              fill="var(--muted-foreground)"
              fillOpacity={0.12}
              stroke="none"
              connectNulls={false}
              name="Minimum"
            />
            <Line
              type="monotone"
              dataKey="restingBpm"
              stroke={CHART.heartRate}
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              name="Oura-labelled rest"
            />
            <Line
              type="monotone"
              dataKey="rollingAvg"
              stroke={CHART.heartRate}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              strokeOpacity={0.6}
              dot={false}
              connectNulls={false}
              name="7-day average"
            />
            <Line
              type="monotone"
              dataKey="awakeBpm"
              stroke="var(--muted-foreground)"
              strokeWidth={1}
              strokeDasharray="2 3"
              dot={false}
              connectNulls={false}
              name="Oura-labelled awake"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
