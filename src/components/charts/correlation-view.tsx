"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type ScatterShapeProps,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PatternDirectionLabel } from "@/components/pattern-direction-label";
import { AXIS_TICK, CHART } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";

interface CorrelationPoint {
  day: string;
  x: number;
  y: number;
  anomalyDirection: string | null;
}

interface CorrelationPair {
  title: string;
  xLabel: string;
  yLabel: string;
  data: CorrelationPoint[];
}

interface CorrelationViewProps {
  pairs: CorrelationPair[];
}

interface CorrelationTooltipPayload {
  payload: CorrelationPoint;
}

/**
 * A flagged day is a triangle in the attention color that points the way of
 * the flag; an unflagged day is a plain dot. Direction is never a hue.
 */
function PointShape({ cx, cy, payload }: ScatterShapeProps) {
  if (cx == null || cy == null) return null;
  const direction = (payload as CorrelationPoint | undefined)?.anomalyDirection;
  if (direction === "hyper" || direction === "hypo") {
    const d =
      direction === "hyper"
        ? `M${cx},${cy - 5}L${cx + 5},${cy + 4}L${cx - 5},${cy + 4}Z`
        : `M${cx - 5},${cy - 4}L${cx + 5},${cy - 4}L${cx},${cy + 5}Z`;
    return (
      <path d={d} fill={CHART.attention} stroke="var(--card)" strokeWidth={1} />
    );
  }
  return <circle cx={cx} cy={cy} r={3.5} fill={CHART.axis} fillOpacity={0.7} />;
}

function flaggedLast(a: CorrelationPoint, b: CorrelationPoint): number {
  return Number(a.anomalyDirection != null) - Number(b.anomalyDirection != null);
}

function CorrelationTooltip({
  active,
  payload,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: CorrelationTooltipPayload[];
  xLabel: string;
  yLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as CorrelationPoint;
  return (
    <ChartTooltipFrame title={p.day}>
      <ChartTooltipRow label={xLabel} value={p.x.toFixed(2)} />
      <ChartTooltipRow label={yLabel} value={p.y.toFixed(2)} />
      {p.anomalyDirection && (
        <p className="flex items-center gap-1 pt-0.5">
          <PatternDirectionLabel direction={p.anomalyDirection} />
          flag
        </p>
      )}
    </ChartTooltipFrame>
  );
}

export function CorrelationView({ pairs }: CorrelationViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metric Relationships</CardTitle>
        <CardDescription className="space-y-2">
          <p>Same-day metric pairs.</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="text-attention">▲</span>
              Higher-activation flag
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="text-attention">▼</span>
              Lower-activation flag
            </li>
            <li className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">●</span>
              Unflagged
            </li>
          </ul>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-6 gap-y-8 md:grid-cols-2">
          {pairs.map((pair, i) => (
            <figure key={i} className="min-w-0">
              <figcaption className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{pair.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  N={pair.data.length} paired{" "}
                  {pair.data.length === 1 ? "day" : "days"}
                </span>
              </figcaption>
              {pair.data.length >= 2 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis
                      dataKey="x"
                      type="number"
                      name={pair.xLabel}
                      domain={["auto", "auto"]}
                      tick={AXIS_TICK}
                      label={{
                        value: pair.xLabel,
                        position: "bottom",
                        fontSize: AXIS_TICK.fontSize,
                        fill: CHART.axis,
                      }}
                    />
                    <YAxis
                      dataKey="y"
                      type="number"
                      name={pair.yLabel}
                      domain={["auto", "auto"]}
                      tick={AXIS_TICK}
                      label={{
                        value: pair.yLabel,
                        angle: -90,
                        position: "insideLeft",
                        fontSize: AXIS_TICK.fontSize,
                        fill: CHART.axis,
                      }}
                    />
                    <Tooltip
                      content={
                        <CorrelationTooltip
                          xLabel={pair.xLabel}
                          yLabel={pair.yLabel}
                        />
                      }
                    />
                    <Scatter
                      data={[...pair.data].sort(flaggedLast)}
                      fill={CHART.axis}
                      shape={PointShape}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
                  At least 2 paired days are needed to plot this relationship.
                </div>
              )}
            </figure>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          These plots do not calculate correlation or show causation. Look for
          patterns that repeat across more paired days.
        </p>
      </CardContent>
    </Card>
  );
}
