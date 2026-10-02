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
import { AXIS_TICK } from "./chart-theme";

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
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="cycleNumber"
              tick={AXIS_TICK}
              tickFormatter={(v) => `Shift #${v}`}
            />
            <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}d`} />
            <Tooltip
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [`${Number(value)} days`, "Shift Interval"]}
              labelFormatter={(label) => `Shift #${label}`}
            />
            <Bar
              dataKey="interShiftDays"
              fill="var(--foreground)"
              fillOpacity={0.7}
              maxBarSize={48}
              name="Shift Interval"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
