"use client";

import {
  BarChart,
  Bar,
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

interface CycleLengthPoint {
  cycleNumber: number;
  interShiftDays: number | null;
}

interface CycleLengthChartProps {
  data: CycleLengthPoint[];
}

export const MIN_THERMAL_SHIFT_INTERVALS = 3;

export function CycleLengthChart({ data }: CycleLengthChartProps) {
  const filtered = data.filter((d) => d.interShiftDays != null);
  if (filtered.length < MIN_THERMAL_SHIFT_INTERVALS) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thermal-Shift Intervals</CardTitle>
        <CardDescription>
          {filtered.length} observed intervals · calendar days between detected
          temperature shifts, not menstrual-cycle length
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={filtered}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis
              dataKey="cycleNumber"
              fontSize={12}
              tick={{ fill: "oklch(0.708 0 0)" }}
              tickFormatter={(v) => `Shift #${v}`}
            />
            <YAxis
              fontSize={12}
              tick={{ fill: "oklch(0.708 0 0)" }}
              tickFormatter={(v) => `${v}d`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                borderColor: "oklch(1 0 0 / 10%)",
                borderRadius: "0.5rem",
                color: "oklch(0.985 0 0)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [`${Number(value)} days`, "Shift Interval"]}
              labelFormatter={(label) => `Shift #${label}`}
            />
            <Bar
              dataKey="interShiftDays"
              fill="oklch(0.65 0.2 350)"
              fillOpacity={0.8}
              name="Shift Interval"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
