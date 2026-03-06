"use client";

import {
  LineChart,
  Line,
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
import { ResearchTooltip } from "@/components/research-tooltip";

interface WithinNightPoint {
  day: string;
  hrvCV: number | null;
  hrCV: number | null;
  fragmentation: number | null;
}

interface WithinNightChartProps {
  data: WithinNightPoint[];
  limitations?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WithinNightTooltipContent({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as WithinNightPoint;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      {p.hrvCV != null && (
        <p style={{ color: "#34d399" }}>HRV CV: {(p.hrvCV * 100).toFixed(1)}%</p>
      )}
      {p.hrCV != null && (
        <p style={{ color: "#f87171" }}>HR CV: {(p.hrCV * 100).toFixed(1)}%</p>
      )}
      {p.fragmentation != null && (
        <p style={{ color: "#f59e0b" }}>Fragmentation: {p.fragmentation.toFixed(3)}</p>
      )}
    </div>
  );
}

export function WithinNightChart({ data, limitations }: WithinNightChartProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Within-Night Variability
              <ResearchTooltip metric="withinNightVariability" />
            </CardTitle>
            <CardDescription>
              HRV and HR coefficient of variation within each night + hypnogram fragmentation
            </CardDescription>
          </div>
          <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-medium">
            Strongest Predictor
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2 mb-4 text-xs text-amber-200/80">
          Within-night sleep variability detected hypomanic episodes ~3 days before onset with 94% sensitivity
          (Luykx et al., 2025)
        </div>
        <div className="rounded-md bg-blue-500/5 border border-blue-500/20 px-3 py-2 mb-4 text-xs text-blue-200/80">
          <span className="font-medium text-blue-300">What to watch for:</span>{" "}
          Spikes in HRV CV or HR CV mean your heart rate was unusually erratic during sleep — research links this to
          hypomanic episodes ~3 days before onset. Rising fragmentation means more frequent sleep stage transitions
          (restless sleep). Watch for 2–3 consecutive days of elevated values rather than single-night spikes.
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
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
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip content={<WithinNightTooltipContent />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="hrvCV"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              name="HRV CV"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="hrCV"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
              name="HR CV"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="fragmentation"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              name="Fragmentation"
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
        {limitations && (
          <p className="text-xs text-muted-foreground mt-2">{limitations}</p>
        )}
      </CardContent>
    </Card>
  );
}
