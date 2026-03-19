"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
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

interface CyclePrediction {
  periodStartDay: string | null;
  ovulationDay: string | null;
  nextPeriodDay: string | null;
  cycleLength: number | null;
}

interface CyclePhaseChartProps {
  dailyData: CyclePhaseDataPoint[];
  cycles: CyclePrediction[];
}

type Phase = "menstrual" | "follicular" | "ovulatory" | "luteal";

function determinePhase(day: string, cycles: CyclePrediction[]): Phase | null {
  for (const cycle of cycles) {
    if (!cycle.periodStartDay) continue;
    const periodStart = cycle.periodStartDay;
    const ovulation = cycle.ovulationDay;
    const nextPeriod = cycle.nextPeriodDay;

    if (day < periodStart) continue;
    if (nextPeriod && day >= nextPeriod) continue;

    const dayMs = new Date(day).getTime();
    const startMs = new Date(periodStart).getTime();
    const daysSinceStart = Math.floor((dayMs - startMs) / 86400000);

    if (daysSinceStart < 5) return "menstrual";

    if (ovulation) {
      const ovMs = new Date(ovulation).getTime();
      const daysToOv = Math.floor((ovMs - startMs) / 86400000);
      if (daysSinceStart < daysToOv - 1) return "follicular";
      if (daysSinceStart <= daysToOv + 1) return "ovulatory";
      return "luteal";
    }

    const len = cycle.cycleLength ?? 28;
    const estOv = Math.round(len * 0.5);
    if (daysSinceStart < estOv - 1) return "follicular";
    if (daysSinceStart <= estOv + 1) return "ovulatory";
    return "luteal";
  }
  return null;
}

const PHASE_COLORS: Record<Phase, string> = {
  menstrual: "#f87171",
  follicular: "#34d399",
  ovulatory: "#fbbf24",
  luteal: "#a78bfa",
};

const PHASE_ORDER: Phase[] = ["menstrual", "follicular", "ovulatory", "luteal"];

interface PhaseAvg {
  phase: string;
  sleepHours: number | null;
  efficiency: number | null;
  avgHrv: number | null;
  moodScore: number | null;
  tempDelta: number | null;
  count: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PhaseTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as PhaseAvg;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium capitalize">{p.phase}</p>
      <p className="text-muted-foreground">{p.count} days</p>
      {p.sleepHours != null && <p>Sleep: {p.sleepHours.toFixed(1)}h</p>}
      {p.efficiency != null && <p>Efficiency: {p.efficiency.toFixed(0)}%</p>}
      {p.avgHrv != null && <p style={{ color: "#34d399" }}>HRV: {p.avgHrv.toFixed(0)} ms</p>}
      {p.moodScore != null && <p>Mood: {p.moodScore > 0 ? "+" : ""}{p.moodScore.toFixed(1)}</p>}
      {p.tempDelta != null && <p>Temp: {p.tempDelta > 0 ? "+" : ""}{p.tempDelta.toFixed(2)}&deg;C</p>}
    </div>
  );
}

export function CyclePhaseChart({ dailyData, cycles }: CyclePhaseChartProps) {
  if (cycles.length === 0 || dailyData.length === 0) return null;

  const buckets: Record<Phase, { sleep: number[]; eff: number[]; hrv: number[]; mood: number[]; temp: number[] }> = {
    menstrual: { sleep: [], eff: [], hrv: [], mood: [], temp: [] },
    follicular: { sleep: [], eff: [], hrv: [], mood: [], temp: [] },
    ovulatory: { sleep: [], eff: [], hrv: [], mood: [], temp: [] },
    luteal: { sleep: [], eff: [], hrv: [], mood: [], temp: [] },
  };

  for (const d of dailyData) {
    const phase = determinePhase(d.day, cycles);
    if (!phase) continue;
    if (d.sleepHours != null) buckets[phase].sleep.push(d.sleepHours);
    if (d.efficiency != null) buckets[phase].eff.push(d.efficiency);
    if (d.avgHrv != null) buckets[phase].hrv.push(d.avgHrv);
    if (d.moodScore != null) buckets[phase].mood.push(d.moodScore);
    if (d.temperatureDelta != null) buckets[phase].temp.push(d.temperatureDelta);
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const chartData: PhaseAvg[] = PHASE_ORDER
    .map((phase) => ({
      phase,
      sleepHours: avg(buckets[phase].sleep),
      efficiency: avg(buckets[phase].eff),
      avgHrv: avg(buckets[phase].hrv),
      moodScore: avg(buckets[phase].mood),
      tempDelta: avg(buckets[phase].temp),
      count: Math.max(buckets[phase].sleep.length, buckets[phase].eff.length, buckets[phase].hrv.length),
    }))
    .filter((d) => d.count > 0);

  if (chartData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cycle Phase Effects</CardTitle>
        <CardDescription>
          Average sleep, HRV, and mood metrics by menstrual cycle phase
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Sleep &amp; Efficiency by Phase</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                <XAxis
                  dataKey="phase"
                  fontSize={11}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                />
                <YAxis yAxisId="hours" fontSize={10} tick={{ fill: "oklch(0.708 0 0)" }} tickFormatter={(v) => `${v}h`} />
                <YAxis yAxisId="pct" orientation="right" fontSize={10} tick={{ fill: "oklch(0.708 0 0)" }} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={<PhaseTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="hours" dataKey="sleepHours" name="Sleep (h)" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Bar key={i} dataKey="sleepHours" fill={PHASE_COLORS[d.phase as Phase]} fillOpacity={0.7} />
                  ))}
                </Bar>
                <Bar yAxisId="pct" dataKey="efficiency" name="Efficiency (%)" fill="#60a5fa" fillOpacity={0.5} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">HRV &amp; Mood by Phase</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" />
                <XAxis
                  dataKey="phase"
                  fontSize={11}
                  tick={{ fill: "oklch(0.708 0 0)" }}
                  tickFormatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
                />
                <YAxis yAxisId="hrv" fontSize={10} tick={{ fill: "oklch(0.708 0 0)" }} label={{ value: "HRV (ms)", angle: -90, position: "insideLeft", fontSize: 10, fill: "oklch(0.708 0 0)" }} />
                <YAxis yAxisId="mood" orientation="right" fontSize={10} tick={{ fill: "oklch(0.708 0 0)" }} domain={[-3, 3]} label={{ value: "Mood", angle: 90, position: "insideRight", fontSize: 10, fill: "oklch(0.708 0 0)" }} />
                <Tooltip content={<PhaseTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="hrv" dataKey="avgHrv" name="HRV (ms)" fill="#34d399" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                <Bar yAxisId="mood" dataKey="moodScore" name="Mood" fill="#fbbf24" fillOpacity={0.6} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Bipolar medication can affect cycle regularity and temperature patterns. PMDD symptoms may overlap with mood episode signals.
        </p>
      </CardContent>
    </Card>
  );
}
