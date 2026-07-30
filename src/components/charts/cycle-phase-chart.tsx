"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CyclePhaseDataPoint {
  day: string;
  sleepHours: number | null;
  efficiency: number | null;
  avgHrv: number | null;
  moodScore: number | null;
  temperatureDelta: number | null;
}

interface CyclePhaseChartProps {
  dailyData: CyclePhaseDataPoint[];
  thermalShiftDays: string[];
}

type ShiftWindow = "before_shift" | "shift_window" | "after_shift";

const WINDOW_ORDER: ShiftWindow[] = [
  "before_shift",
  "shift_window",
  "after_shift",
];

const WINDOW_COLORS: Record<ShiftWindow, string> = {
  before_shift: "#34d399",
  shift_window: "#fbbf24",
  after_shift: "#a78bfa",
};

function formatWindowLabel(window: string): string {
  if (window === "before_shift") return "7 days before";
  if (window === "shift_window") return "Shift to +2d";
  return "Days 3–10 after";
}

function determineWindow(
  day: string,
  thermalShiftDays: string[]
): ShiftWindow | null {
  const candidates: Array<{ window: ShiftWindow; distance: number }> = [];
  for (const shiftDay of thermalShiftDays) {
    const difference = differenceInCalendarDays(
      parseISO(day),
      parseISO(shiftDay)
    );
    if (difference >= -7 && difference <= -1) {
      candidates.push({
        window: "before_shift",
        distance: Math.abs(difference),
      });
    } else if (difference >= 0 && difference <= 2) {
      candidates.push({ window: "shift_window", distance: difference });
    } else if (difference >= 3 && difference <= 10) {
      candidates.push({ window: "after_shift", distance: difference });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0]?.window ?? null;
}

interface WindowAverage {
  window: ShiftWindow;
  sleepHours: number | null;
  efficiency: number | null;
  avgHrv: number | null;
  moodScore: number | null;
  tempDelta: number | null;
  counts: {
    sleep: number;
    efficiency: number;
    hrv: number;
    mood: number;
    temperature: number;
  };
}

function average(values: number[]): number | null {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function WindowTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: WindowAverage }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{formatWindowLabel(point.window)}</p>
      {point.sleepHours != null && (
        <p>
          Sleep: {point.sleepHours.toFixed(1)}h (N={point.counts.sleep})
        </p>
      )}
      {point.efficiency != null && (
        <p>
          Efficiency: {point.efficiency.toFixed(0)}% (N=
          {point.counts.efficiency})
        </p>
      )}
      {point.avgHrv != null && (
        <p style={{ color: "#34d399" }}>
          HRV: {point.avgHrv.toFixed(0)} ms (N={point.counts.hrv})
        </p>
      )}
      {point.moodScore != null && (
        <p>
          Mood: {point.moodScore.toFixed(1)} (N={point.counts.mood})
        </p>
      )}
      {point.tempDelta != null && (
        <p>
          Temp: {point.tempDelta > 0 ? "+" : ""}
          {point.tempDelta.toFixed(2)}°C (N={point.counts.temperature})
        </p>
      )}
    </div>
  );
}

export function CyclePhaseChart({
  dailyData,
  thermalShiftDays,
}: CyclePhaseChartProps) {
  if (thermalShiftDays.length === 0 || dailyData.length === 0) return null;

  const buckets: Record<
    ShiftWindow,
    {
      sleep: number[];
      efficiency: number[];
      hrv: number[];
      mood: number[];
      temperature: number[];
    }
  > = {
    before_shift: {
      sleep: [],
      efficiency: [],
      hrv: [],
      mood: [],
      temperature: [],
    },
    shift_window: {
      sleep: [],
      efficiency: [],
      hrv: [],
      mood: [],
      temperature: [],
    },
    after_shift: {
      sleep: [],
      efficiency: [],
      hrv: [],
      mood: [],
      temperature: [],
    },
  };

  for (const point of dailyData) {
    const window = determineWindow(point.day, thermalShiftDays);
    if (!window) continue;
    if (point.sleepHours != null) buckets[window].sleep.push(point.sleepHours);
    if (point.efficiency != null) {
      buckets[window].efficiency.push(point.efficiency);
    }
    if (point.avgHrv != null) buckets[window].hrv.push(point.avgHrv);
    if (point.moodScore != null) buckets[window].mood.push(point.moodScore);
    if (point.temperatureDelta != null) {
      buckets[window].temperature.push(point.temperatureDelta);
    }
  }

  const chartData = WINDOW_ORDER.map(
    (window): WindowAverage => ({
      window,
      sleepHours: average(buckets[window].sleep),
      efficiency: average(buckets[window].efficiency),
      avgHrv: average(buckets[window].hrv),
      moodScore: average(buckets[window].mood),
      tempDelta: average(buckets[window].temperature),
      counts: {
        sleep: buckets[window].sleep.length,
        efficiency: buckets[window].efficiency.length,
        hrv: buckets[window].hrv.length,
        mood: buckets[window].mood.length,
        temperature: buckets[window].temperature.length,
      },
    })
  ).filter((point) => Object.values(point.counts).some((count) => count > 0));

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thermal-Shift Window Patterns</CardTitle>
        <CardDescription>
          Descriptive averages before and after app-detected temperature shifts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Sleep &amp; Efficiency by Window
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(1 0 0 / 5%)"
                />
                <XAxis
                  dataKey="window"
                  fontSize={11}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  tickFormatter={formatWindowLabel}
                />
                <YAxis
                  yAxisId="hours"
                  fontSize={10}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  tickFormatter={(value) => `${value}h`}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  fontSize={10}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<WindowTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="hours"
                  dataKey="sleepHours"
                  name="Sleep (h)"
                  radius={[4, 4, 0, 0]}
                >
                  {chartData.map((point) => (
                    <Cell
                      key={point.window}
                      fill={WINDOW_COLORS[point.window]}
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
                <Bar
                  yAxisId="pct"
                  dataKey="efficiency"
                  name="Efficiency (%)"
                  fill="#60a5fa"
                  fillOpacity={0.5}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">
              HRV &amp; Mood by Window
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="oklch(1 0 0 / 5%)"
                />
                <XAxis
                  dataKey="window"
                  fontSize={11}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  tickFormatter={formatWindowLabel}
                />
                <YAxis
                  yAxisId="hrv"
                  fontSize={10}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  label={{
                    value: "HRV (ms)",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                    fill: "oklch(0.708 0 0)",
                  }}
                />
                <YAxis
                  yAxisId="mood"
                  orientation="right"
                  fontSize={10}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  domain={[-3, 3]}
                  label={{
                    value: "Mood (-3 to +3)",
                    angle: 90,
                    position: "insideRight",
                    fontSize: 10,
                    fill: "oklch(0.708 0 0)",
                  }}
                />
                <Tooltip content={<WindowTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  yAxisId="hrv"
                  dataKey="avgHrv"
                  name="HRV (ms)"
                  fill="#34d399"
                  fillOpacity={0.7}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="mood"
                  dataKey="moodScore"
                  name="Mood (-3 to +3)"
                  fill="#fbbf24"
                  fillOpacity={0.6}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Sample counts vary by metric and appear in the tooltip. These windows
          are descriptive, not physiological phases or fertility guidance.
        </p>
      </CardContent>
    </Card>
  );
}
