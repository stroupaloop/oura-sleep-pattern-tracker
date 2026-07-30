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
  CardDescription,
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

function getOuraCategory(
  cardiovascularAge: number,
  actualAge: number | null | undefined
): string | null {
  if (actualAge == null) return null;
  const difference = cardiovascularAge - actualAge;
  if (difference <= -6) return "Below";
  if (difference >= 6) return "Above";
  return "Aligned";
}

export function CardiovascularAgeChart({
  data,
  actualAge,
  days = 90,
}: CardiovascularAgeChartProps) {
  const chartData = data.slice(-days);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Oura Cardiovascular Age</CardTitle>
        <CardDescription>
          Oura estimate compared with your actual age; focus on the longer-term trend
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
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
              formatter={(value: any) => {
                const cardiovascularAge = Number(value);
                const category = getOuraCategory(
                  cardiovascularAge,
                  actualAge
                );
                return [
                  `${cardiovascularAge} years${category ? ` · ${category}` : ""}`,
                  "Oura Cardiovascular Age",
                ];
              }}
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
              connectNulls={false}
              name="Oura Cardiovascular Age"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
