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
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CycleLengthPoint {
  cycleNumber: number;
  cycleLength: number | null;
}

interface CycleLengthChartProps {
  data: CycleLengthPoint[];
  days?: number;
}

export function CycleLengthChart({ data }: CycleLengthChartProps) {
  const filtered = data.filter((d) => d.cycleLength != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cycle Length</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={filtered}>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
            <XAxis
              dataKey="cycleNumber"
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              tickFormatter={(v) => `#${v}`}
            />
            <YAxis
              fontSize={11}
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
              formatter={(value: any) => [`${Number(value)} days`, "Cycle Length"]}
              labelFormatter={(label) => `Cycle #${label}`}
            />
            <Bar
              dataKey="cycleLength"
              fill="oklch(0.65 0.2 350)"
              fillOpacity={0.8}
              name="Cycle Length"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
