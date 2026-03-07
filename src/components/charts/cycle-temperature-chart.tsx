"use client";

import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CycleTemperaturePoint {
  day: string;
  temperatureDelta: number | null;
  phase?: string;
}

interface CycleTemperatureChartProps {
  data: CycleTemperaturePoint[];
  ovulationDays?: string[];
  days?: number;
}

const phaseColors: Record<string, string> = {
  follicular: "oklch(0.85 0.1 240)",
  luteal: "oklch(0.85 0.1 350)",
  menstrual: "oklch(0.85 0.1 25)",
};

interface PhaseRange {
  start: string;
  end: string;
  phase: string;
}

function buildPhaseRanges(data: CycleTemperaturePoint[]): PhaseRange[] {
  const ranges: PhaseRange[] = [];
  let rangeStart: string | null = null;
  let currentPhase = "";

  for (const d of data) {
    if (d.phase && d.phase !== currentPhase) {
      if (rangeStart) {
        ranges.push({ start: rangeStart, end: d.day, phase: currentPhase });
      }
      rangeStart = d.day;
      currentPhase = d.phase;
    } else if (!d.phase && rangeStart) {
      ranges.push({ start: rangeStart, end: d.day, phase: currentPhase });
      rangeStart = null;
      currentPhase = "";
    }
  }
  if (rangeStart && data.length > 0) {
    ranges.push({
      start: rangeStart,
      end: data[data.length - 1].day,
      phase: currentPhase,
    });
  }
  return ranges;
}

export function CycleTemperatureChart({
  data,
  ovulationDays,
  days = 90,
}: CycleTemperatureChartProps) {
  const sliced = data.slice(-days);
  const phaseRanges = buildPhaseRanges(sliced);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cycle Temperature Deviation</CardTitle>
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
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
              tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
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
                const v = Number(value);
                return [`${v > 0 ? "+" : ""}${v.toFixed(2)}`, "Temp Delta"];
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {phaseRanges.map((r, i) => (
              <ReferenceArea
                key={`phase-${i}`}
                x1={r.start}
                x2={r.end}
                fill={phaseColors[r.phase] ?? "oklch(0.85 0.1 240)"}
                fillOpacity={0.15}
              />
            ))}
            {ovulationDays?.map((day) => (
              <ReferenceLine
                key={`ovulation-${day}`}
                x={day}
                stroke="oklch(0.708 0 0)"
                strokeDasharray="4 4"
                label={{
                  value: "O",
                  position: "top",
                  fill: "oklch(0.708 0 0)",
                  fontSize: 10,
                }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="temperatureDelta"
              stroke="oklch(0.65 0.2 350)"
              strokeWidth={2}
              dot={false}
              connectNulls
              name="Temp Delta"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
