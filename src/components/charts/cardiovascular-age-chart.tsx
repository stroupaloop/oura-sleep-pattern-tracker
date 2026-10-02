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
import { AXIS_TICK, CHART } from "./chart-theme";
import { formatIsoDay } from "@/lib/date-utils";

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
  const latest = [...chartData]
    .reverse()
    .find((point) => point.vascularAge != null);
  const latestDifference =
    latest?.vascularAge != null && actualAge != null
      ? latest.vascularAge - actualAge
      : null;
  const latestCategory =
    latest?.vascularAge != null
      ? getOuraCategory(latest.vascularAge, actualAge)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Oura Cardiovascular Age</CardTitle>
        <CardDescription>
          Oura estimate compared with your actual age; focus on the longer-term trend
        </CardDescription>
      </CardHeader>
      <CardContent>
        {latest?.vascularAge != null && (
          <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums">
            <span className="font-medium">
              Latest: {latest.vascularAge} years
            </span>
            {latestDifference != null && (
              <span className="text-muted-foreground">
                {latestDifference === 0
                  ? "Matches actual age"
                  : `${Math.abs(latestDifference)} years ${
                      latestDifference < 0 ? "below" : "above"
                    } actual age`}
              </span>
            )}
            {latestCategory && (
              <span className="text-muted-foreground">
                Oura category: {latestCategory}
              </span>
            )}
            <span className="text-muted-foreground">
              Through {formatIsoDay(latest.day) ?? latest.day}
            </span>
          </div>
        )}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickFormatter={(d) => d.slice(5)}
              tick={AXIS_TICK}
              interval="preserveStartEnd"
            />
            <YAxis
              // Fit the visible range (and actual age); from zero it flattens.
              domain={[
                (min: number) => Math.max(0, Math.floor(min - 3)),
                (max: number) => Math.ceil(max + 3),
              ]}
              allowDecimals={false}
              tick={AXIS_TICK}
              tickFormatter={(v) => `${v}y`}
              label={{
                value: "years",
                angle: -90,
                position: "insideLeft",
                fontSize: 11,
              }}
            />
            <Tooltip
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
                stroke={CHART.baseline}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
                label={{
                  value: "Actual Age",
                  position: "insideBottomRight",
                  fontSize: 11,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="vascularAge"
              stroke="var(--foreground)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              name="Oura Cardiovascular Age"
            />
          </LineChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-muted-foreground">
          Source: Oura · estimated cardiovascular age, not a diagnosis
        </p>
      </CardContent>
    </Card>
  );
}
