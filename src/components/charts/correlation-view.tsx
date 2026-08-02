"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

function getColor(dir: string | null): string {
  if (dir === "hyper") return "#f59e0b";
  if (dir === "hypo") return "#3b82f6";
  return "oklch(0.708 0 0)";
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
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      <p className="text-muted-foreground">
        {xLabel}: {p.x.toFixed(2)}
      </p>
      <p className="text-muted-foreground">
        {yLabel}: {p.y.toFixed(2)}
      </p>
      {p.anomalyDirection && (
        <p className={p.anomalyDirection === "hyper" ? "text-amber-400" : "text-blue-400"}>
          {p.anomalyDirection === "hyper"
            ? "Higher-activation flag"
            : "Lower-activation flag"}
        </p>
      )}
    </div>
  );
}

export function CorrelationView({ pairs }: CorrelationViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metric Relationships</CardTitle>
        <CardDescription>
          Same-day metric pairs. Orange = higher-activation flag, blue =
          lower-activation flag, gray = unflagged.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {pairs.map((pair, i) => (
            <div key={i} className="border rounded-lg p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium">{pair.title}</p>
                <span className="text-xs text-muted-foreground">
                  N={pair.data.length} paired{" "}
                  {pair.data.length === 1 ? "day" : "days"}
                </span>
              </div>
              {pair.data.length >= 2 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8%)" />
                    <XAxis
                      dataKey="x"
                      type="number"
                      name={pair.xLabel}
                      fontSize={10}
                      tick={{ fill: "oklch(0.708 0 0)" }}
                      label={{ value: pair.xLabel, position: "bottom", fontSize: 10, fill: "oklch(0.708 0 0)" }}
                    />
                    <YAxis
                      dataKey="y"
                      type="number"
                      name={pair.yLabel}
                      fontSize={10}
                      tick={{ fill: "oklch(0.708 0 0)" }}
                      label={{ value: pair.yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "oklch(0.708 0 0)" }}
                    />
                    <Tooltip
                      content={
                        <CorrelationTooltip
                          xLabel={pair.xLabel}
                          yLabel={pair.yLabel}
                        />
                      }
                    />
                    <Scatter data={pair.data} fill="oklch(0.708 0 0)">
                      {pair.data.map((d, j) => (
                        <Cell key={j} fill={getColor(d.anomalyDirection)} fillOpacity={0.7} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
                  At least 2 paired days are needed to plot this relationship.
                </div>
              )}
            </div>
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
