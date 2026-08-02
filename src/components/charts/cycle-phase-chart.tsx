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

export const MIN_PHASE_SHIFT_COUNT = 2;
export const MIN_PHASE_WINDOW_OBSERVATIONS = 3;

type ShiftWindow = "before_shift" | "shift_window" | "after_shift";
type PhaseMetric = "sleep" | "efficiency" | "hrv" | "mood";

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

function determineWindow(difference: number): ShiftWindow | null {
  if (difference >= -7 && difference <= -1) return "before_shift";
  if (difference >= 0 && difference <= 2) return "shift_window";
  if (difference >= 3 && difference <= 10) return "after_shift";
  return null;
}

interface EvidenceCount {
  shifts: number;
  nights: number;
}

export interface WindowAverage {
  window: ShiftWindow;
  sleepHours: number | null;
  efficiency: number | null;
  avgHrv: number | null;
  moodScore: number | null;
  counts: {
    sleep: EvidenceCount;
    efficiency: EvidenceCount;
    hrv: EvidenceCount;
    mood: EvidenceCount;
  };
}

function average(values: number[]): number | null {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function emptyEvidenceCount(): EvidenceCount {
  return { shifts: 0, nights: 0 };
}

function metricValue(
  point: CyclePhaseDataPoint,
  metric: PhaseMetric
): number | null {
  if (metric === "sleep") return point.sleepHours;
  if (metric === "efficiency") return point.efficiency;
  if (metric === "hrv") return point.avgHrv;
  return point.moodScore;
}

interface MetricWindowEvidence {
  value: number | null;
  shifts: Set<string>;
  nights: number;
}

export interface CyclePhaseSummary {
  data: WindowAverage[];
  contributingShiftCount: number;
  showSleepChart: boolean;
  showHrvMoodChart: boolean;
}

export function buildCyclePhaseSummary(
  dailyData: CyclePhaseDataPoint[],
  thermalShiftDays: string[]
): CyclePhaseSummary {
  const uniqueDailyData = [
    ...new Map(dailyData.map((point) => [point.day, point])).values(),
  ];
  const uniqueShiftDays = [...new Set(thermalShiftDays)].sort();
  const metrics: PhaseMetric[] = ["sleep", "efficiency", "hrv", "mood"];
  const evidence = Object.fromEntries(
    WINDOW_ORDER.map((window) => [
      window,
      Object.fromEntries(
        metrics.map((metric) => [
          metric,
          {
            value: null,
            shifts: new Set<string>(),
            nights: 0,
          } satisfies MetricWindowEvidence,
        ])
      ) as Record<PhaseMetric, MetricWindowEvidence>,
    ])
  ) as Record<ShiftWindow, Record<PhaseMetric, MetricWindowEvidence>>;

  for (const shiftDay of uniqueShiftDays) {
    const pointsByWindow = Object.fromEntries(
      WINDOW_ORDER.map((window) => [window, [] as CyclePhaseDataPoint[]])
    ) as Record<ShiftWindow, CyclePhaseDataPoint[]>;

    for (const point of uniqueDailyData) {
      const difference = differenceInCalendarDays(
        parseISO(point.day),
        parseISO(shiftDay)
      );
      const window = determineWindow(difference);
      if (window) pointsByWindow[window].push(point);
    }

    for (const window of WINDOW_ORDER) {
      for (const metric of metrics) {
        const values = pointsByWindow[window]
          .map((point) => metricValue(point, metric))
          .filter((value): value is number => value != null);
        if (values.length < MIN_PHASE_WINDOW_OBSERVATIONS) continue;

        const bucket = evidence[window][metric];
        const perShiftAverage = average(values);
        if (perShiftAverage == null) continue;
        bucket.value =
          bucket.value == null
            ? perShiftAverage
            : bucket.value + perShiftAverage;
        bucket.shifts.add(shiftDay);
        bucket.nights += values.length;
      }
    }
  }

  for (const window of WINDOW_ORDER) {
    for (const metric of metrics) {
      const bucket = evidence[window][metric];
      bucket.value =
        bucket.shifts.size >= MIN_PHASE_SHIFT_COUNT && bucket.value != null
          ? bucket.value / bucket.shifts.size
          : null;
    }
  }

  const enabledMetrics = new Set(
    metrics.filter(
      (metric) =>
        WINDOW_ORDER.filter(
          (window) => evidence[window][metric].value != null
        ).length >= 2
    )
  );
  const contributingShiftDays = new Set<string>();
  const data = WINDOW_ORDER.map((window): WindowAverage => {
    const qualified = (metric: PhaseMetric) =>
      enabledMetrics.has(metric) && evidence[window][metric].value != null;
    for (const metric of metrics) {
      if (qualified(metric)) {
        for (const shiftDay of evidence[window][metric].shifts) {
          contributingShiftDays.add(shiftDay);
        }
      }
    }

    const countsFor = (metric: PhaseMetric): EvidenceCount =>
      qualified(metric)
        ? {
            shifts: evidence[window][metric].shifts.size,
            nights: evidence[window][metric].nights,
          }
        : emptyEvidenceCount();

    return {
      window,
      sleepHours: qualified("sleep") ? evidence[window].sleep.value : null,
      efficiency: qualified("efficiency")
        ? evidence[window].efficiency.value
        : null,
      avgHrv: qualified("hrv") ? evidence[window].hrv.value : null,
      moodScore: qualified("mood") ? evidence[window].mood.value : null,
      counts: {
        sleep: countsFor("sleep"),
        efficiency: countsFor("efficiency"),
        hrv: countsFor("hrv"),
        mood: countsFor("mood"),
      },
    };
  });

  return {
    data,
    contributingShiftCount: contributingShiftDays.size,
    showSleepChart:
      enabledMetrics.has("sleep") || enabledMetrics.has("efficiency"),
    showHrvMoodChart:
      enabledMetrics.has("hrv") || enabledMetrics.has("mood"),
  };
}

function formatEvidence(count: EvidenceCount): string {
  return `${count.shifts} shift${count.shifts === 1 ? "" : "s"}, ${
    count.nights
  } night${count.nights === 1 ? "" : "s"}`;
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
          Sleep: {point.sleepHours.toFixed(1)}h (
          {formatEvidence(point.counts.sleep)})
        </p>
      )}
      {point.efficiency != null && (
        <p>
          Efficiency: {point.efficiency.toFixed(0)}% (
          {formatEvidence(point.counts.efficiency)})
        </p>
      )}
      {point.avgHrv != null && (
        <p style={{ color: "#34d399" }}>
          HRV: {point.avgHrv.toFixed(0)} ms (
          {formatEvidence(point.counts.hrv)})
        </p>
      )}
      {point.moodScore != null && (
        <p>
          Mood: {point.moodScore.toFixed(1)} (
          {formatEvidence(point.counts.mood)})
        </p>
      )}
    </div>
  );
}

export function CyclePhaseChart({
  dailyData,
  thermalShiftDays,
}: CyclePhaseChartProps) {
  const {
    data: displayData,
    contributingShiftCount,
    showSleepChart,
    showHrvMoodChart,
  } = buildCyclePhaseSummary(dailyData, thermalShiftDays);
  if (
    contributingShiftCount < MIN_PHASE_SHIFT_COUNT ||
    (!showSleepChart && !showHrvMoodChart)
  ) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thermal-Shift Window Patterns</CardTitle>
        <CardDescription>
          {contributingShiftCount} detected shifts contribute. Each value first
          averages within a shift, then across shifts; it appears only with at
          least 2 shifts and {MIN_PHASE_WINDOW_OBSERVATIONS} nights per shift.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            {displayData.map((point) => {
              const counts = [
                point.sleepHours != null ? point.counts.sleep : null,
                point.efficiency != null ? point.counts.efficiency : null,
                point.avgHrv != null ? point.counts.hrv : null,
                point.moodScore != null ? point.counts.mood : null,
              ].filter((count): count is EvidenceCount => count != null);
              const shiftCounts = counts.map((count) => count.shifts);
              const nightCounts = counts.map((count) => count.nights);
              const shiftMinimum =
                shiftCounts.length > 0 ? Math.min(...shiftCounts) : null;
              const shiftMaximum =
                shiftCounts.length > 0 ? Math.max(...shiftCounts) : null;
              const nightMinimum =
                nightCounts.length > 0 ? Math.min(...nightCounts) : null;
              const nightMaximum =
                nightCounts.length > 0 ? Math.max(...nightCounts) : null;
              return (
                <div key={point.window} className="rounded-md bg-muted/40 p-2">
                  <p>{formatWindowLabel(point.window)}</p>
                  <p className="font-medium text-foreground">
                    {shiftMinimum == null ||
                    shiftMaximum == null ||
                    nightMinimum == null ||
                    nightMaximum == null
                      ? "No qualified metric"
                      : `${
                          shiftMinimum === shiftMaximum
                            ? shiftMinimum
                            : `${shiftMinimum}–${shiftMaximum}`
                        } shifts · ${
                          nightMinimum === nightMaximum
                            ? nightMinimum
                            : `${nightMinimum}–${nightMaximum}`
                        } nights`}
                  </p>
                </div>
              );
            })}
          </div>

          {showSleepChart ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Sleep &amp; Efficiency by Window
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={displayData}>
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
                  {displayData.map((point) => (
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
          ) : null}

          {showHrvMoodChart ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              HRV &amp; Mood by Window
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={displayData}>
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
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Shift and night counts vary by metric; exact counts appear in the
          tooltip. These windows are descriptive, not physiological phases or
          fertility guidance.
        </p>
      </CardContent>
    </Card>
  );
}
