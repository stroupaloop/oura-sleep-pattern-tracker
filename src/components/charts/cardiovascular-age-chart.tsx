"use client";

import {
  LineChart,
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

interface CardiovascularAgePoint {
  day: string;
  vascularAge: number | null;
}

interface CardiovascularAgeChartProps {
  data: CardiovascularAgePoint[];
  actualAge?: number | null;
  days?: number;
}

export function CardiovascularAgeChart({
  data,
  actualAge,
  days = 90,
}: CardiovascularAgeChartProps) {
  const filtered = data.slice(-days).filter((d) => d.vascularAge != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cardiovascular Age</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={filtered}>
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
              tickFormatter={(v) => `${v}y`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                borderColor: "oklch(1 0 0 / 10%)",
                borderRadius: "0.5rem",
                color: "oklch(0.985 0 0)",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [`${Number(value)} years`, "Vascular Age"]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {actualAge != null && (
              <ReferenceLine
                y={actualAge}
                stroke="oklch(0.708 0 0)"
                strokeDasharray="4 4"
                label={{
                  value: "Actual Age",
                  position: "right",
                  fill: "oklch(0.708 0 0)",
                  fontSize: 11,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="vascularAge"
              stroke="oklch(0.65 0.2 260)"
              strokeWidth={2}
              dot={false}
              connectNulls
              name="Vascular Age"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
