"use client";

import {
  AreaChart,
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

interface Vo2MaxPoint {
  day: string;
  vo2Max: number | null;
}

interface Vo2MaxChartProps {
  data: Vo2MaxPoint[];
  days?: number;
}

export function Vo2MaxChart({ data, days = 90 }: Vo2MaxChartProps) {
  const chartData = data.slice(-days);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Oura-Estimated VO₂ Max</CardTitle>
        <CardDescription>
          Estimated aerobic capacity in mL/kg/min, not a laboratory measurement
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="vo2MaxGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="oklch(0.65 0.2 150)"
                  stopOpacity={0.4}
                />
                <stop
                  offset="95%"
                  stopColor="oklch(0.65 0.2 150)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
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
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                borderColor: "oklch(1 0 0 / 10%)",
                borderRadius: "0.5rem",
                color: "oklch(0.985 0 0)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [
                `${Number(value).toFixed(1)} mL/kg/min`,
                "Oura-Estimated VO₂ Max",
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="vo2Max"
              stroke="oklch(0.65 0.2 150)"
              strokeWidth={2}
              fill="url(#vo2MaxGradient)"
              connectNulls={false}
              name="Oura-Estimated VO₂ Max"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
