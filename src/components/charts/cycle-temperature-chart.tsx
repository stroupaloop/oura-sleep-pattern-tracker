"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CycleTemperaturePoint {
  day: string;
  temperatureDelta: number | null;
}

interface CycleTemperatureChartProps {
  data: CycleTemperaturePoint[];
  thermalShiftDays?: string[];
  days?: number;
}

export function CycleTemperatureChart({
  data,
  thermalShiftDays,
  days = 90,
}: CycleTemperatureChartProps) {
  const sliced = data.slice(-days);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nighttime Skin-Temperature Deviation</CardTitle>
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
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                borderColor: "oklch(1 0 0 / 10%)",
                borderRadius: "0.5rem",
                color: "oklch(0.985 0 0)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => {
                const v = Number(value);
                return [
                  `${v > 0 ? "+" : ""}${v.toFixed(2)} °C`,
                  "Oura Deviation",
                ];
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {thermalShiftDays?.map((day) => (
              <ReferenceLine
                key={`thermal-shift-${day}`}
                x={day}
                stroke="oklch(0.708 0 0)"
                strokeDasharray="4 4"
                label={{
                  value: "Detected shift",
                  position: "top",
                  fill: "oklch(0.708 0 0)",
                  fontSize: 10,
                }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="temperatureDelta"
              stroke="oklch(0.65 0.2 350)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              name="Oura Temperature Deviation"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
