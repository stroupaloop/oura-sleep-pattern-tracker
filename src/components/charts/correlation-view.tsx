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

function getColor(dir: string | null): string {
  if (dir === "hyper") return "#f59e0b";
  if (dir === "hypo") return "#3b82f6";
  return "oklch(0.708 0 0)";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CorrelationTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as CorrelationPoint;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      <p className="text-muted-foreground">X: {p.x.toFixed(2)}</p>
      <p className="text-muted-foreground">Y: {p.y.toFixed(2)}</p>
      {p.anomalyDirection && (
        <p className={p.anomalyDirection === "hyper" ? "text-amber-400" : "text-blue-400"}>
          {p.anomalyDirection}
        </p>
      )}
    </div>
  );
}

export function CorrelationView({ pairs }: CorrelationViewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Metric Correlations</CardTitle>
        <CardDescription>
          Scatter plots of key metric pairs. Orange = hyper-pattern, Blue = hypo-pattern, Gray = normal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {pairs.map((pair, i) => (
            <div key={i} className="border rounded-lg p-3">
              <p className="text-sm font-medium mb-2">{pair.title}</p>
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
                  <Tooltip content={<CorrelationTooltip />} />
                  <Scatter data={pair.data} fill="oklch(0.708 0 0)">
                    {pair.data.map((d, j) => (
                      <Cell key={j} fill={getColor(d.anomalyDirection)} fillOpacity={0.7} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
