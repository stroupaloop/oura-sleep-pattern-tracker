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
import { AXIS_TICK, CHART, legendLabel } from "./chart-theme";

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

/**
 * A detected thermal shift reads the same in every cycle view: a dashed Mist
 * line topped by a Moonlight marker.
 */
export const THERMAL_SHIFT_LINE = {
  stroke: CHART.baseline,
  strokeDasharray: "4 4",
} as const;

/** Leaves room above the plot for the shift marker's words. */
export const THERMAL_SHIFT_CHART_MARGIN = {
  top: 24,
  right: 5,
  bottom: 5,
  left: 5,
} as const;

export function ThermalShiftMarker({
  viewBox,
  text,
  textAnchor = "middle",
}: {
  viewBox?: { x?: number; y?: number };
  text?: string;
  textAnchor?: "start" | "middle" | "end";
}) {
  if (viewBox?.x == null || viewBox.y == null) return null;
  const textOffset =
    textAnchor === "start" ? -4 : textAnchor === "end" ? 4 : 0;
  return (
    <g>
      <circle cx={viewBox.x} cy={viewBox.y} r={3.5} fill="var(--foreground)" />
      {text && (
        <text
          x={viewBox.x + textOffset}
          y={viewBox.y - 8}
          textAnchor={textAnchor}
          fontSize={11}
          fill={CHART.axis}
        >
          {text}
        </text>
      )}
    </g>
  );
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
  // One set of words is enough; on a phone they would collide on every line.
  const visibleShiftIndexes = (thermalShiftDays ?? [])
    .map((day) => sliced.findIndex((point) => point.day === day))
    .filter((index) => index >= 0);
  const labelledShiftIndex =
    visibleShiftIndexes.length > 0 ? Math.max(...visibleShiftIndexes) : -1;
  const labelledShiftDay = sliced[labelledShiftIndex]?.day ?? null;
  const labelAnchor =
    labelledShiftIndex > sliced.length / 2 ? "end" : "start";

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
          <ComposedChart data={sliced} margin={THERMAL_SHIFT_CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickFormatter={(d) => d.slice(5)}
              tick={AXIS_TICK}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={AXIS_TICK}
              tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
            />
            <Tooltip
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
            <Legend formatter={legendLabel} />
            <ReferenceLine
              y={0}
              stroke={CHART.baseline}
              strokeDasharray="2 4"
              ifOverflow="extendDomain"
              label={{
                value: "Personal baseline",
                position: "insideTopLeft",
                fontSize: 11,
              }}
            />
            {thermalShiftDays?.map((day) => (
              <ReferenceLine
                key={`thermal-shift-${day}`}
                x={day}
                {...THERMAL_SHIFT_LINE}
                label={
                  <ThermalShiftMarker
                    text={day === labelledShiftDay ? "Detected shift" : undefined}
                    textAnchor={labelAnchor}
                  />
                }
              />
            ))}
            <Line
              type="monotone"
              dataKey="eligibleTemperatureDelta"
              stroke="var(--foreground)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              name="Eligible Oura deviation"
            />
            <Line
              type="linear"
              dataKey="restModeTemperatureDelta"
              stroke="var(--muted-foreground)"
              strokeOpacity={0}
              dot={{ r: 4, fill: "var(--muted-foreground)", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "var(--muted-foreground)", strokeWidth: 0 }}
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
