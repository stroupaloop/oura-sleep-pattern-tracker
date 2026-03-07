"use client";

import {
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  Scatter,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RestModePoint {
  day: string;
  hasTag: boolean;
}

interface RestPeriod {
  startDay: string;
  endDay: string;
}

interface RestModeTimelineProps {
  data: RestModePoint[];
  restPeriods: RestPeriod[];
  days?: number;
}

export function RestModeTimeline({
  data,
  restPeriods,
  days = 90,
}: RestModeTimelineProps) {
  const sliced = data.slice(-days);
  const scatterData = sliced
    .filter((d) => d.hasTag)
    .map((d) => ({ day: d.day, value: 1 }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rest Mode Timeline</CardTitle>
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
              domain={[0, 2]}
              hide
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "oklch(0.205 0 0)",
                borderColor: "oklch(1 0 0 / 10%)",
                borderRadius: "0.5rem",
                color: "oklch(0.985 0 0)",
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {restPeriods.map((period, i) => (
              <ReferenceArea
                key={`rest-${i}`}
                x1={period.startDay}
                x2={period.endDay}
                fill="#ef4444"
                fillOpacity={0.2}
                label={{
                  value: "Rest Mode",
                  position: "insideTop",
                  fill: "oklch(0.708 0 0)",
                  fontSize: 10,
                }}
              />
            ))}
            <Scatter
              data={scatterData}
              dataKey="value"
              fill="oklch(0.65 0.2 25)"
              name="Tag"
              r={3}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
