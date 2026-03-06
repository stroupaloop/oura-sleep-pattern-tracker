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
  ReferenceArea,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResearchTooltip } from "@/components/research-tooltip";

interface CircadianPoint {
  day: string;
  is: number | null;
  iv: number | null;
  ra: number | null;
  isEpisode?: boolean;
  episodeTier?: string;
}

interface CircadianChartProps {
  data: CircadianPoint[];
  limitations?: string;
}

function CircadianTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as CircadianPoint;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{p.day}</p>
      {p.is != null && <p style={{ color: "#34d399" }}>IS (Stability): {p.is.toFixed(3)}</p>}
      {p.iv != null && <p style={{ color: "#f59e0b" }}>IV (Variability): {p.iv.toFixed(3)}</p>}
      {p.ra != null && <p style={{ color: "#a78bfa" }}>RA (Amplitude): {p.ra.toFixed(3)}</p>}
      {p.isEpisode && (
        <p className="text-red-400 text-xs mt-1">Episode: {p.episodeTier}</p>
      )}
    </div>
  );
}

export function CircadianChart({ data, limitations }: CircadianChartProps) {
  const episodeRanges: { start: string; end: string; tier: string }[] = [];
  let rangeStart: string | null = null;
  let currentTier = "";
  for (const d of data) {
    if (d.isEpisode) {
      if (!rangeStart) {
        rangeStart = d.day;
        currentTier = d.episodeTier ?? "watch";
      }
    } else if (rangeStart) {
      episodeRanges.push({ start: rangeStart, end: d.day, tier: currentTier });
      rangeStart = null;
    }
  }
  if (rangeStart && data.length > 0) {
    episodeRanges.push({ start: rangeStart, end: data[data.length - 1].day, tier: currentTier });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Circadian Rhythms
          <ResearchTooltip metric="circadianIS" />
        </CardTitle>
        <CardDescription>
          Interdaily Stability (IS), Intradaily Variability (IV), Relative Amplitude (RA) — all 0-1 scale
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              domain={[0, 1]}
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
            />
            <Tooltip content={<CircadianTooltipContent />} />
            <Legend />
            {episodeRanges.map((r, i) => (
              <ReferenceArea
                key={i}
                x1={r.start}
                x2={r.end}
                fill={r.tier === "alert" ? "#ef4444" : r.tier === "warning" ? "#f59e0b" : "#3b82f6"}
                fillOpacity={0.1}
              />
            ))}
            <Line
              type="monotone"
              dataKey="is"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              name="IS (Stability)"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="iv"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="IV (Variability)"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="ra"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              name="RA (Amplitude)"
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
