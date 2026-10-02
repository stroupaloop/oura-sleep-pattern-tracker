"use client";

import {
  Bar,
  ComposedChart,
  Rectangle,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import { Panel } from "@/components/ui/panel";
import { PatternDirectionLabel } from "@/components/pattern-direction-label";
import { describePatternDirection } from "@/lib/design/pattern-direction";
import {
  isPatternTier,
  tierColor,
  tierLabel,
  type PatternTier,
} from "@/lib/design/pattern-tiers";
import {
  EPISODE_MARKERS,
  episodeLabel,
  isEpisodeState,
  type EpisodeState,
} from "@/lib/episode-states";
import { formatNightLabel } from "@/lib/health/format";
import { AXIS_TICK } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";

interface Episode {
  day: string;
  tier: string;
  direction: string | null;
  confidence: number;
  primaryDrivers: string | null;
}

interface SelfReport {
  day: string;
  episodeState: string;
}

interface Thresholds {
  watch: number;
  warning: number;
  alert: number;
}

interface TimelinePoint {
  day: string;
  score: number | null;
  direction: string | null;
  tier: string | null;
  drivers: string[];
  selfReport: string | null;
}

type MarkedState = Exclude<EpisodeState, "none">;
type MarkerShape = "up" | "down" | "diamond";

const LEGEND_TIERS: PatternTier[] = ["watch", "warning", "alert"];
const LEGEND_STATES: MarkedState[] = ["depressive", "hypomanic", "manic", "mixed"];

/** An unknown self-reported state still gets a marker, drawn as mixed. */
function markedState(state: string): MarkedState {
  return isEpisodeState(state) && state !== "none" ? state : "mixed";
}

function markerPath(shape: MarkerShape, cx: number, cy: number, size: number) {
  if (shape === "up") {
    return `M${cx} ${cy - size}L${cx + size} ${cy + size}L${cx - size} ${cy + size}Z`;
  }
  if (shape === "down") {
    return `M${cx} ${cy + size}L${cx + size} ${cy - size}L${cx - size} ${cy - size}Z`;
  }
  return `M${cx} ${cy - size}L${cx + size} ${cy}L${cx} ${cy + size}L${cx - size} ${cy}Z`;
}

function EpisodeMarker({
  state,
  cx,
  cy,
  size = 4.5,
}: {
  state: MarkedState;
  cx: number;
  cy: number;
  size?: number;
}) {
  const marker = EPISODE_MARKERS[state];
  const color = `var(--level-${marker.level})`;
  const outlined = marker.shape === "diamond";
  return (
    <path
      d={markerPath(marker.shape, cx, cy, size)}
      fill={outlined ? "var(--card)" : color}
      stroke={outlined ? color : "var(--card)"}
      strokeWidth={outlined ? 1.5 : 1}
      strokeLinejoin="round"
    />
  );
}

function EpisodeMarkerIcon({ state }: { state: MarkedState }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0">
      <EpisodeMarker state={state} cx={6} cy={6} />
    </svg>
  );
}

function DirectionIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 shrink-0">
      <path d={markerPath(direction, 6, 6, 3.5)} fill="var(--foreground)" />
    </svg>
  );
}

/**
 * A day's evidence bar: the tier's color once flagged, and the pattern's
 * direction as a shape above it, so the hue only ever says the tier.
 */
function EvidenceBarShape(props: BarShapeProps) {
  const { x, y, width, height } = props;
  const point = props.payload as TimelinePoint;
  const flagged = isPatternTier(point.tier);
  // Too thin a bar to carry a shape; the tooltip still says the direction.
  const arrow =
    flagged && width >= 3 ? describePatternDirection(point.direction).arrow : null;
  const arrowSize = Math.min(3.5, Math.max(2.5, width / 2));
  return (
    <g>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={[2, 2, 0, 0]}
        fill={tierColor(point.tier)}
        fillOpacity={flagged ? 1 : 0.35}
      />
      {arrow && (
        <path
          d={markerPath(arrow, x + width / 2, y - arrowSize - 3, arrowSize)}
          fill="var(--foreground)"
        />
      )}
    </g>
  );
}

interface TooltipPayloadItem {
  payload: TimelinePoint;
}

function TimelineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <ChartTooltipFrame
      title={formatNightLabel(point.day, { weekday: false })}
      className="max-w-72"
    >
      <ChartTooltipRow
        label="Evidence"
        value={
          point.score != null ? `${point.score.toFixed(1)}/10` : "Unavailable"
        }
      />
      {point.direction && (
        <ChartTooltipRow
          label="Direction"
          value={<PatternDirectionLabel direction={point.direction} />}
        />
      )}
      {isPatternTier(point.tier) && (
        <ChartTooltipRow
          color={tierColor(point.tier)}
          label="Pattern flag"
          value={tierLabel(point.tier)}
        />
      )}
      {point.selfReport && (
        <ChartTooltipRow
          label="Self-report"
          value={
            <span className="inline-flex items-center gap-1.5">
              <EpisodeMarkerIcon state={markedState(point.selfReport)} />
              {episodeLabel(point.selfReport)}
            </span>
          }
        />
      )}
      {point.drivers.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Drivers: {point.drivers.join(", ")}
        </p>
      )}
    </ChartTooltipFrame>
  );
}

function buildTimeline(
  episodes: Episode[],
  selfReports: SelfReport[]
): TimelinePoint[] {
  const points = new Map<string, TimelinePoint>();
  for (const episode of episodes) {
    let drivers: string[] = [];
    if (episode.primaryDrivers) {
      try {
        drivers = JSON.parse(episode.primaryDrivers);
      } catch {
        drivers = [];
      }
    }
    points.set(episode.day, {
      day: episode.day,
      score: episode.confidence,
      direction: episode.direction,
      tier: episode.tier,
      drivers,
      selfReport: null,
    });
  }
  for (const report of selfReports) {
    const existing = points.get(report.day);
    points.set(report.day, {
      day: report.day,
      score: existing?.score ?? null,
      direction: existing?.direction ?? null,
      tier: existing?.tier ?? null,
      drivers: existing?.drivers ?? [],
      selfReport: report.episodeState,
    });
  }
  return [...points.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function EpisodeTimeline({
  episodes,
  selfReports,
  thresholds,
}: {
  episodes: Episode[];
  selfReports: SelfReport[];
  thresholds: Thresholds;
}) {
  const data = buildTimeline(episodes, selfReports);
  if (data.length === 0) return null;

  // Each threshold gets its own tick, so a line is read by its value too.
  const ticks = [
    ...new Set([0, thresholds.watch, thresholds.warning, thresholds.alert, 10]),
  ].sort((a, b) => a - b);

  return (
    <Panel
      id="evidence-timeline"
      title="Multi-Day Evidence Timeline"
      description="App heuristic from wearable signals only. Evidence is not episode probability."
    >
      <p className="mb-3 text-xs text-muted-foreground tabular-nums">
        Watch ≥ {thresholds.watch} · Warning ≥ {thresholds.warning} · Alert ≥{" "}
        {thresholds.alert} · Consecutive-day rules also apply
      </p>
      <div
        role="img"
        aria-label="Multi-day wearable evidence scores with pattern thresholds and self-reported episode markers"
      >
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={data}
            margin={{ top: 14, right: 10, left: 0, bottom: 5 }}
          >
            <XAxis
              dataKey="day"
              tickFormatter={(day: string) => day.slice(5)}
              tick={AXIS_TICK}
            />
            <YAxis
              domain={[0, 10]}
              ticks={ticks}
              tick={AXIS_TICK}
              label={{
                value: "Evidence (0–10)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10 },
              }}
            />
            <Tooltip content={<TimelineTooltip />} />
            {LEGEND_TIERS.map((tier) => (
              <ReferenceLine
                key={tier}
                y={thresholds[tier]}
                stroke={tierColor(tier)}
                strokeDasharray="3 3"
                strokeOpacity={0.55}
              />
            ))}
            <Bar
              dataKey="score"
              maxBarSize={12}
              shape={EvidenceBarShape}
            />
            {data
              .filter(
                (point): point is TimelinePoint & { selfReport: string } =>
                  point.selfReport !== null
              )
              .map((point) => (
                <ReferenceDot
                  key={`self-report-${point.day}`}
                  x={point.day}
                  y={0.25}
                  r={5}
                  shape={(dot: { cx?: number; cy?: number }) => (
                    <EpisodeMarker
                      state={markedState(point.selfReport)}
                      cx={dot.cx ?? 0}
                      cy={dot.cy ?? 0}
                    />
                  )}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-sm bg-muted-foreground/35"
            />
            No flag
          </span>
          {LEGEND_TIERS.map((tier) => (
            <span key={tier} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: tierColor(tier) }}
              />
              {tierLabel(tier)}
            </span>
          ))}
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            Above a flagged bar:
            <span className="inline-flex items-center gap-1">
              <DirectionIcon direction="up" />
              higher,
            </span>
            <span className="inline-flex items-center gap-1">
              <DirectionIcon direction="down" />
              lower activation
            </span>
          </span>
        </p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span>Markers along the baseline are optional self-reports:</span>
          {LEGEND_STATES.map((state) => (
            <span key={state} className="inline-flex items-center gap-1.5">
              <EpisodeMarkerIcon state={state} />
              {episodeLabel(state)}
            </span>
          ))}
        </p>
      </div>
    </Panel>
  );
}
