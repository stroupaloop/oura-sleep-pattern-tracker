"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
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
import { Stat } from "@/components/ui/stat";
import { moodColor } from "@/lib/design/mood-scale";
import { AXIS_TICK, CHART, legendLabel } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";
import {
  THERMAL_SHIFT_CHART_MARGIN,
  THERMAL_SHIFT_LINE,
  ThermalShiftMarker,
} from "./cycle-temperature-chart";

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

const SLEEP_COLOR = "var(--foreground)";
const EFFICIENCY_COLOR = "var(--muted-foreground)";

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
  payload?: ReadonlyArray<{ payload?: WindowAverage }>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <ChartTooltipFrame title={formatWindowLabel(point.window)}>
      {point.sleepHours != null && (
        <ChartTooltipRow
          color={SLEEP_COLOR}
          label={`Sleep (${formatEvidence(point.counts.sleep)})`}
          value={`${point.sleepHours.toFixed(1)}h`}
        />
      )}
      {point.efficiency != null && (
        <ChartTooltipRow
          color={EFFICIENCY_COLOR}
          label={`Efficiency (${formatEvidence(point.counts.efficiency)})`}
          value={`${point.efficiency.toFixed(0)}%`}
        />
      )}
      {point.avgHrv != null && (
        <ChartTooltipRow
          color={CHART.hrv}
          label={`HRV (${formatEvidence(point.counts.hrv)})`}
          value={`${point.avgHrv.toFixed(0)} ms`}
        />
      )}
      {point.moodScore != null && (
        <ChartTooltipRow
          color={moodColor(point.moodScore)}
          label={`Mood (${formatEvidence(point.counts.mood)})`}
          value={point.moodScore.toFixed(1)}
        />
      )}
    </ChartTooltipFrame>
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
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
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
                <Stat
                  key={point.window}
                  size="sm"
                  label={formatWindowLabel(point.window)}
                  value={
                    shiftMinimum == null ||
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
                        } nights`
                  }
                />
              );
            })}
          </div>

          {showSleepChart ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Sleep &amp; Efficiency by Window
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={displayData} margin={THERMAL_SHIFT_CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="window"
                  tick={AXIS_TICK}
                  tickFormatter={formatWindowLabel}
                />
                <YAxis
                  yAxisId="hours"
                  tick={AXIS_TICK}
                  tickFormatter={(value) => `${value}h`}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  tick={AXIS_TICK}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<WindowTooltip />} />
                <Legend formatter={legendLabel} />
                <ReferenceLine
                  x="shift_window"
                  yAxisId="hours"
                  position="start"
                  {...THERMAL_SHIFT_LINE}
                  label={<ThermalShiftMarker text="Detected shift" />}
                />
                <Bar
                  yAxisId="hours"
                  dataKey="sleepHours"
                  name="Sleep (h)"
                  fill={SLEEP_COLOR}
                  fillOpacity={0.85}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="pct"
                  dataKey="efficiency"
                  name="Efficiency (%)"
                  fill={EFFICIENCY_COLOR}
                  fillOpacity={0.6}
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
              <BarChart data={displayData} margin={THERMAL_SHIFT_CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="window"
                  tick={AXIS_TICK}
                  tickFormatter={formatWindowLabel}
                />
                <YAxis
                  yAxisId="hrv"
                  tick={AXIS_TICK}
                  label={{
                    value: "HRV (ms)",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  yAxisId="mood"
                  orientation="right"
                  tick={AXIS_TICK}
                  domain={[-3, 3]}
                  label={{
                    value: "Mood (-3 to +3)",
                    angle: 90,
                    position: "insideRight",
                    fontSize: 11,
                  }}
                />
                <Tooltip content={<WindowTooltip />} />
                <Legend formatter={legendLabel} />
                <ReferenceLine
                  x="shift_window"
                  yAxisId="hrv"
                  position="start"
                  {...THERMAL_SHIFT_LINE}
                  label={<ThermalShiftMarker text="Detected shift" />}
                />
                <Bar
                  yAxisId="hrv"
                  dataKey="avgHrv"
                  name="HRV (ms)"
                  fill={CHART.hrv}
                  fillOpacity={0.7}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="mood"
                  dataKey="moodScore"
                  name="Mood (-3 to +3)"
                  fill={moodColor(0)}
                  radius={[4, 4, 0, 0]}
                >
                  {displayData.map((point) => (
                    <Cell
                      key={point.window}
                      fill={moodColor(point.moodScore ?? 0)}
                    />
                  ))}
                </Bar>
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
