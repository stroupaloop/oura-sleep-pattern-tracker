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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BedtimePoint {
  day: string;
  actualBedtime: number | null;
  optimalStart: number | null;
  optimalEnd: number | null;
}

interface BedtimeTrendChartProps {
  data: BedtimePoint[];
  days?: number;
}

function formatMinutesAsTime(minutes: number): string {
  const adjusted = minutes < 0 ? minutes + 1440 : minutes;
  const h = Math.floor(adjusted / 60) % 24;
  const m = adjusted % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function BedtimeTrendChart({
  data,
  days = 90,
}: BedtimeTrendChartProps) {
  const sliced = data.slice(-days);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bedtime Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={sliced}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis
              dataKey="day"
              tickFormatter={(d) => d.slice(5)}
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              reversed
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              tickFormatter={formatMinutesAsTime}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                borderColor: "oklch(1 0 0 / 10%)",
                borderRadius: "0.5rem",
                color: "oklch(0.985 0 0)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => [
                formatMinutesAsTime(Number(value)),
                String(name),
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="optimalStart"
              stroke="none"
              fill="transparent"
              activeDot={false}
              name="Optimal Start"
            />
            <Area
              type="monotone"
              dataKey="optimalEnd"
              stroke="none"
              fill="#a78bfa"
              fillOpacity={0.15}
              activeDot={false}
              name="Optimal End"
            />
            <Line
              type="monotone"
              dataKey="actualBedtime"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              connectNulls
              name="Actual Bedtime"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
