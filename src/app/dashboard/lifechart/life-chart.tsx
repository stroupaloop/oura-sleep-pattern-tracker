"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  Rectangle,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
  ReferenceLine,
  type BarShapeProps,
} from "recharts";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { AXIS_TICK, CHART, legendLabel } from "@/components/charts/chart-theme";
import {
  ChartTooltipFrame,
  ChartTooltipRow,
} from "@/components/charts/chart-tooltip";
import { collectLifeChartDays } from "@/lib/life-chart";
import { formatIsoDay } from "@/lib/date-utils";
import {
  formatMoodValue,
  moodColor,
  moodLabel,
} from "@/lib/design/mood-scale";
import {
  isPatternTier,
  tierColor,
  tierLabel,
  type PatternTier,
} from "@/lib/design/pattern-tiers";
import { episodeLabel } from "@/lib/episode-states";
import { axisDayProps, formatNightLabel } from "@/lib/health/format";

interface AnalysisRow {
  day: string;
  totalSleepMinutes: number | null;
  baselineSleepMinutes: number | null;
  anomalyDirection: string | null;
  isAnomaly: number | null;
  hrvZScore: number | null;
  bedtimeZScore: number | null;
  withinNightHrvCV: number | null;
  steps: number | null;
}

interface MoodRow {
  day: string;
  moodScore: number;
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
  tags: string | null;
  notes: string | null;
  episodeState: string | null;
}

interface EpisodeRow {
  day: string;
  tier: string;
  direction: string | null;
}

interface LifeChartProps {
  analysis: AnalysisRow[];
  moods: MoodRow[];
  episodes: EpisodeRow[];
  /** The pattern checks' daily threshold, in standard deviations. */
  threshold: number;
}

interface MoodPoint {
  day: string;
  moodScore: number | null;
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
  hasMood: boolean;
  notes: string | null;
  tags: string[];
  episodeState: string | null;
}

interface SleepPoint {
  day: string;
  sleepHours: number | null;
  baselineHours: number | null;
}

interface MetricsPoint {
  day: string;
  hrvZ: number | null;
  bedtimeZ: number | null;
}

interface StepsPoint {
  day: string;
  steps: number | null;
}

interface ContextDay {
  day: string;
  tags: string[];
  tier: string | null;
}

interface TooltipProps<T> {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: T }>;
}

// Series without a hue of their own: Moonlight solid, Mist dashed, Haze dotted.
const MOONLIGHT = "var(--foreground)";
const MIST = "var(--muted-foreground)";
const HAZE = "var(--faint-foreground)";

const CONTEXT_TIERS: PatternTier[] = ["alert", "warning", "watch"];

// Taller is a higher tier, so the strip reads without its colors.
const TIER_HEIGHT: Record<PatternTier, string> = {
  watch: "h-3",
  warning: "h-4.5",
  alert: "h-6",
};

function dayLabel(day: string): string {
  return formatIsoDay(day) ?? day;
}

function nightLabel(day: string): string {
  return formatNightLabel(day, { weekday: false });
}

function describeZ(z: number, below: string, above: string): string {
  return z === 0
    ? "at baseline"
    : `${Math.abs(z).toFixed(1)} SD ${z < 0 ? below : above} baseline`;
}

function describeContextDay({ day, tags, tier }: ContextDay): string {
  const parts = [dayLabel(day)];
  if (isPatternTier(tier)) parts.push(`${tierLabel(tier)} pattern flag`);
  if (tags.length > 0) parts.push(`Tags: ${tags.join(", ")}`);
  return parts.join(" · ");
}

function parseTags(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function MoodBarShape(props: BarShapeProps) {
  const point = props.payload as MoodPoint;
  return (
    <Rectangle
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      radius={[2, 2, 0, 0]}
      fill={moodColor(point.moodScore ?? Number.NaN)}
    />
  );
}

function UnusualDot({
  cx,
  cy,
  value,
  threshold,
}: {
  cx?: number;
  cy?: number;
  value?: unknown;
  threshold: number;
}) {
  if (
    cx == null ||
    cy == null ||
    typeof value !== "number" ||
    Math.abs(value) < threshold
  ) {
    return null;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={CHART.attention}
      stroke="var(--card)"
      strokeWidth={1}
    />
  );
}

function MoodTooltip({ active, payload }: TooltipProps<MoodPoint>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (!p.hasMood || p.moodScore == null) {
    return (
      <ChartTooltipFrame title={dayLabel(p.day)}>
        <p className="text-muted-foreground">No mood logged</p>
      </ChartTooltipFrame>
    );
  }
  return (
    <ChartTooltipFrame title={dayLabel(p.day)} className="max-w-60">
      <ChartTooltipRow
        color={moodColor(p.moodScore)}
        label="Mood"
        value={`${formatMoodValue(p.moodScore)} · ${moodLabel(p.moodScore)}`}
      />
      {p.episodeState && p.episodeState !== "none" && (
        <ChartTooltipRow label="Episode" value={episodeLabel(p.episodeState)} />
      )}
      {p.tags.length > 0 && (
        <p className="text-muted-foreground">{p.tags.join(", ")}</p>
      )}
      {p.notes && (
        <p className="text-muted-foreground mt-1 italic leading-tight">
          “{p.notes}”
        </p>
      )}
    </ChartTooltipFrame>
  );
}

function EnergyTooltip({ active, payload }: TooltipProps<MoodPoint>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipFrame title={dayLabel(p.day)}>
      {p.energyScore != null && (
        <ChartTooltipRow color={MOONLIGHT} label="Energy" value={p.energyScore} />
      )}
      {p.irritabilityScore != null && (
        <ChartTooltipRow
          color={MIST}
          label="Irritability"
          value={p.irritabilityScore}
        />
      )}
      {p.anxietyScore != null && (
        <ChartTooltipRow color={HAZE} label="Anxiety" value={p.anxietyScore} />
      )}
    </ChartTooltipFrame>
  );
}

function SleepTooltip({ active, payload }: TooltipProps<SleepPoint>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipFrame title={nightLabel(p.day)}>
      <ChartTooltipRow
        color={MOONLIGHT}
        label="Sleep"
        value={p.sleepHours != null ? `${p.sleepHours.toFixed(1)}h` : "--"}
      />
      {p.baselineHours != null && (
        <ChartTooltipRow
          color={CHART.baseline}
          label="Baseline"
          value={`${p.baselineHours.toFixed(1)}h`}
          muted
        />
      )}
    </ChartTooltipFrame>
  );
}

function ZLabel({ name, unusual }: { name: string; unusual: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {name}
      {unusual && <Pill tone="attention">Unusual</Pill>}
    </span>
  );
}

function MetricsTooltip({
  active,
  payload,
  threshold,
}: TooltipProps<MetricsPoint> & { threshold: number }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipFrame title={nightLabel(p.day)}>
      {p.hrvZ != null && (
        <ChartTooltipRow
          color={CHART.hrv}
          label={<ZLabel name="HRV" unusual={Math.abs(p.hrvZ) >= threshold} />}
          value={describeZ(p.hrvZ, "below", "above")}
        />
      )}
      {p.bedtimeZ != null && (
        <ChartTooltipRow
          color={MOONLIGHT}
          label={
            <ZLabel name="Bedtime" unusual={Math.abs(p.bedtimeZ) >= threshold} />
          }
          value={describeZ(p.bedtimeZ, "earlier than", "later than")}
        />
      )}
    </ChartTooltipFrame>
  );
}

function StepsTooltip({ active, payload }: TooltipProps<StepsPoint>) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltipFrame title={dayLabel(p.day)}>
      <ChartTooltipRow
        color={MOONLIGHT}
        label="Steps"
        value={p.steps?.toLocaleString() ?? "--"}
      />
    </ChartTooltipFrame>
  );
}

export function LifeChart({
  analysis,
  moods,
  episodes,
  threshold,
}: LifeChartProps) {
  const analysisMap = new Map(analysis.map((row) => [row.day, row]));
  const moodMap = new Map(moods.map((m) => [m.day, m]));
  const episodeMap = new Map(episodes.map((e) => [e.day, e]));

  const allDays = collectLifeChartDays(analysis, moods, episodes);
  const dayAxis = axisDayProps(allDays);
  const syncId = "lifechart";
  const thresholdLabel = `±${Number(threshold.toFixed(2))}`;

  const moodData: MoodPoint[] = allDays.map((day) => {
    const m = moodMap.get(day);
    return {
      day,
      moodScore: m?.moodScore ?? null,
      energyScore: m?.energyScore ?? null,
      irritabilityScore: m?.irritabilityScore ?? null,
      anxietyScore: m?.anxietyScore ?? null,
      hasMood: !!m,
      notes: m?.notes ?? null,
      tags: parseTags(m?.tags),
      episodeState: m?.episodeState ?? null,
    };
  });

  const sleepData: SleepPoint[] = allDays.map((day) => {
    const row = analysisMap.get(day);
    return {
      day,
      sleepHours:
        row?.totalSleepMinutes != null ? row.totalSleepMinutes / 60 : null,
      baselineHours:
        row?.baselineSleepMinutes != null
          ? row.baselineSleepMinutes / 60
          : null,
    };
  });

  const metricsData: MetricsPoint[] = allDays.map((day) => {
    const row = analysisMap.get(day);
    return {
      day,
      hrvZ: row?.hrvZScore ?? null,
      bedtimeZ: row?.bedtimeZScore ?? null,
    };
  });

  const stepsData: StepsPoint[] = allDays.map((day) => ({
    day,
    steps: analysisMap.get(day)?.steps ?? null,
  }));

  const contextData: ContextDay[] = allDays.map((day) => ({
    day,
    tags: parseTags(moodMap.get(day)?.tags),
    tier: episodeMap.get(day)?.tier ?? null,
  }));

  return (
    <div className="space-y-3">
      <Panel
        id="lifechart-mood"
        title="Mood"
        description="Personal mood scale · −3 very low · 0 neutral · +3 very high"
      >
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={moodData} syncId={syncId}>
            <XAxis dataKey="day" hide />
            <YAxis domain={[-3, 3]} hide />
            <Tooltip content={<MoodTooltip />} />
            <Bar dataKey="moodScore" minPointSize={3} shape={MoodBarShape} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {moodData.some((d) => d.energyScore != null || d.irritabilityScore != null || d.anxietyScore != null) && (
        <Panel id="lifechart-energy" title="Energy / Irritability / Anxiety">
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={moodData} syncId={syncId}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" hide />
              <YAxis domain={[1, 5]} tick={AXIS_TICK} />
              <Tooltip content={<EnergyTooltip />} />
              <Legend formatter={legendLabel} />
              <Line type="monotone" dataKey="energyScore" stroke={MOONLIGHT} strokeWidth={1.5} dot={false} name="Energy" legendType="plainline" connectNulls={false} />
              <Line type="monotone" dataKey="irritabilityScore" stroke={MIST} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="Irritability" legendType="plainline" connectNulls={false} />
              <Line type="monotone" dataKey="anxietyScore" stroke={HAZE} strokeWidth={1.5} strokeDasharray="1 3" strokeLinecap="round" dot={false} name="Anxiety" legendType="plainline" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      )}

      <Panel id="lifechart-sleep" title="Sleep Duration">
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={sleepData} syncId={syncId}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" hide />
            <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${v}h`} />
            <Tooltip content={<SleepTooltip />} />
            <Legend formatter={legendLabel} />
            <Area
              type="monotone"
              dataKey="baselineHours"
              stroke={CHART.baseline}
              strokeWidth={1}
              strokeDasharray="3 3"
              fill={CHART.baseline}
              fillOpacity={0.05}
              dot={false}
              name="Baseline"
              legendType="plainline"
            />
            <Area
              type="monotone"
              dataKey="sleepHours"
              stroke={MOONLIGHT}
              fill={MOONLIGHT}
              fillOpacity={0.08}
              strokeWidth={1.5}
              dot={false}
              name="Sleep"
              legendType="plainline"
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        id="lifechart-metrics"
        title="Key Metrics (z-scores)"
        description={`0 = personal rolling baseline · shaded = usual range (±1) · ${thresholdLabel} or more = unusual (marked), not inherently good or bad`}
      >
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={metricsData} syncId={syncId}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" hide />
            <YAxis tick={AXIS_TICK} />
            <Tooltip content={<MetricsTooltip threshold={threshold} />} />
            <Legend formatter={legendLabel} />
            <ReferenceArea
              y1={-1}
              y2={1}
              fill="var(--corridor)"
              fillOpacity={1}
              ifOverflow="extendDomain"
            />
            <ReferenceLine
              y={0}
              stroke={CHART.baseline}
              strokeOpacity={0.65}
              strokeDasharray="3 3"
              ifOverflow="extendDomain"
            />
            {[threshold, -threshold].map((y) => (
              <ReferenceLine
                key={y}
                y={y}
                stroke={HAZE}
                strokeOpacity={0.6}
                strokeDasharray="2 3"
                ifOverflow="extendDomain"
              />
            ))}
            <Line type="monotone" dataKey="hrvZ" stroke={CHART.hrv} strokeWidth={1.5} dot={<UnusualDot threshold={threshold} />} name="HRV" legendType="plainline" connectNulls={false} />
            <Line type="monotone" dataKey="bedtimeZ" stroke={MOONLIGHT} strokeWidth={1.5} dot={<UnusualDot threshold={threshold} />} name="Bedtime" legendType="plainline" connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </Panel>

      <Panel
        id="lifechart-activity"
        title="Activity"
        description="Daily steps · compare sustained changes with your own history"
      >
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={stepsData} syncId={syncId}>
            <XAxis
              dataKey="day"
              {...dayAxis}
              tick={AXIS_TICK}
            />
            <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<StepsTooltip />} />
            <Bar dataKey="steps" fill={MOONLIGHT} fillOpacity={0.5} radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel id="lifechart-context" title="Context">
        <ol
          aria-label="Pattern flags and tags by day"
          className="flex h-6 items-end gap-0.5 overflow-x-auto"
        >
          {contextData.map((d) => {
            const tier = isPatternTier(d.tier) ? d.tier : null;
            if (!tier && d.tags.length === 0) {
              return (
                <li
                  key={d.day}
                  aria-hidden="true"
                  className="h-1 w-2 shrink-0 rounded-sm bg-muted"
                />
              );
            }
            const description = describeContextDay(d);
            return (
              <li
                key={d.day}
                title={description}
                className={cn(
                  "w-2 shrink-0 rounded-sm",
                  tier ? TIER_HEIGHT[tier] : "h-2 bg-muted-foreground"
                )}
                style={tier ? { backgroundColor: tierColor(tier) } : undefined}
              >
                <span className="sr-only">{description}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {CONTEXT_TIERS.map((tier) => (
            <span key={tier} className="inline-flex items-end gap-1">
              <span
                aria-hidden="true"
                className={cn("inline-block w-2 rounded-sm", TIER_HEIGHT[tier])}
                style={{ backgroundColor: tierColor(tier) }}
              />
              {tierLabel(tier)}
            </span>
          ))}
          <span className="inline-flex items-end gap-1">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-sm bg-muted-foreground"
            />
            Tag
          </span>
        </div>
      </Panel>
    </div>
  );
}
