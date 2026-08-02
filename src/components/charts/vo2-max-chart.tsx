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
  const measured = chartData.filter(
    (point): point is Vo2MaxPoint & { vo2Max: number } =>
      point.vo2Max != null
  );
  const first = measured[0] ?? null;
  const latest = measured[measured.length - 1] ?? null;
  const change =
    first && latest && first.day !== latest.day
      ? latest.vo2Max - first.vo2Max
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>VO₂ Max from Oura</CardTitle>
        <CardDescription>
          Value in mL/kg/min; Oura may derive it from profile data or a walking
          test, or store a value added manually
        </CardDescription>
      </CardHeader>
      <CardContent>
        {latest && (
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">
              Latest: {latest.vo2Max.toFixed(1)} mL/kg/min
            </span>
            {change != null && (
              <span className="text-muted-foreground">
                Visible-range change: {change > 0 ? "+" : ""}
                {change.toFixed(1)}
              </span>
            )}
            <span className="text-muted-foreground">Through {latest.day}</span>
          </div>
        )}
        <p className="mb-4 text-xs text-muted-foreground">
          Higher generally reflects greater aerobic capacity. Compare trends
          only when the source method is consistent; no population range is
          applied.
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="vo2MaxGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="oklch(0.65 0.16 240)"
                  stopOpacity={0.4}
                />
                <stop
                  offset="95%"
                  stopColor="oklch(0.65 0.16 240)"
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
              label={{
                value: "mL/kg/min",
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
              formatter={(value: any) => [
                `${Number(value).toFixed(1)} mL/kg/min`,
                "VO₂ Max from Oura",
              ]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Area
              type="monotone"
              dataKey="vo2Max"
              stroke="oklch(0.65 0.16 240)"
              strokeWidth={2}
              fill="url(#vo2MaxGradient)"
              connectNulls={false}
              name="VO₂ Max from Oura"
            />
          </AreaChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          Source: Oura · profile estimate, walking test, or manually added value
        </p>
      </CardContent>
    </Card>
  );
}
