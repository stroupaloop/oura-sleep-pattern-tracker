"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CycleTemperaturePoint {
  day: string;
  temperatureDelta: number | null;
  restModeExcluded: boolean;
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
  const sliced = data.slice(-days).map((point) => ({
    ...point,
    eligibleTemperatureDelta: point.restModeExcluded
      ? null
      : point.temperatureDelta,
    restModeTemperatureDelta: point.restModeExcluded
      ? point.temperatureDelta
      : null,
  }));
  const measuredNightCount = sliced.filter(
    (point) => point.temperatureDelta != null
  ).length;
  const restModeExcludedNightCount = sliced.filter(
    (point) =>
      point.restModeExcluded && point.temperatureDelta != null
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nighttime Skin-Temperature Deviation</CardTitle>
        <CardDescription>
          {days}-day view · {measuredNightCount} measured night
          {measuredNightCount === 1 ? "" : "s"}
          {restModeExcludedNightCount > 0
            ? ` · ${restModeExcludedNightCount} excluded by recorded Rest Mode`
            : ""}
          . 0°C is your Oura personal baseline; higher or lower is context, not
          inherently good or bad. Missing and excluded nights break the line.
        </CardDescription>
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
              formatter={(value: any, name: any) => {
                const v = Number(value);
                return [
                  `${v > 0 ? "+" : ""}${v.toFixed(2)} °C`,
                  String(name),
                ];
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine
              y={0}
              stroke="oklch(0.708 0 0)"
              strokeDasharray="2 4"
              ifOverflow="extendDomain"
              label={{
                value: "Personal baseline",
                position: "insideTopLeft",
                fill: "oklch(0.708 0 0)",
                fontSize: 10,
              }}
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
              dataKey="eligibleTemperatureDelta"
              stroke="oklch(0.65 0.2 350)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              name="Eligible Oura deviation"
            />
            <Line
              type="linear"
              dataKey="restModeTemperatureDelta"
              stroke="#f59e0b"
              strokeOpacity={0}
              dot={{ r: 4, fill: "#f59e0b", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#f59e0b", strokeWidth: 0 }}
              connectNulls={false}
              legendType="circle"
              name="Excluded: recorded Rest Mode"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
