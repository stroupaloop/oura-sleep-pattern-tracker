"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";

interface HypnogramChartProps {
  hypnogram: string;
  hr5min: string | null;
  bedtimeStart: string;
}

const stageMap: Record<string, { label: string; value: number; color: string }> = {
  "1": { label: "Deep", value: 1, color: "#3b82f6" },
  "2": { label: "Light", value: 2, color: "#67e8f9" },
  "3": { label: "REM", value: 3, color: "#a78bfa" },
  "4": { label: "Awake", value: 4, color: "#f97316" },
};

const stageLabels: Record<number, string> = {
  1: "Deep",
  2: "Light",
  3: "REM",
  4: "Awake",
};

const stageColors: Record<number, string> = {
  1: "#3b82f6",
  2: "#67e8f9",
  3: "#a78bfa",
  4: "#f97316",
};

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

interface DataPoint {
  minuteOffset: number;
  time: string;
  stage: number;
  stageLabel: string;
  hr: number | null;
  color: string;
}

function parseHypnogram(
  hypnogram: string,
  hr5min: string | null,
  bedtimeStart: string
): DataPoint[] {
  const start = new Date(bedtimeStart);
  let hrData: number[] = [];
  if (hr5min) {
    try {
      hrData = JSON.parse(hr5min);
    } catch {
      hrData = [];
    }
  }

  return Array.from(hypnogram).map((char, i) => {
    const info = stageMap[char] ?? { label: "Unknown", value: 2, color: "#525252" };
    const time = new Date(start.getTime() + i * 5 * 60 * 1000);
    return {
      minuteOffset: i * 5,
      time: formatClockTime(time),
      stage: info.value,
      stageLabel: info.label,
      hr: hrData[i] ?? null,
      color: info.color,
    };
  });
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
  payload: DataPoint;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{point.time}</p>
      <p style={{ color: stageColors[point.stage] }}>{point.stageLabel}</p>
      {point.hr != null && (
        <p className="text-muted-foreground">{point.hr} bpm</p>
      )}
    </div>
  );
}

export function HypnogramChart({ hypnogram, hr5min, bedtimeStart }: HypnogramChartProps) {
  const data = parseHypnogram(hypnogram, hr5min, bedtimeStart);

  if (data.length === 0) return null;

  const tickInterval = Math.max(1, Math.floor(data.length / 8));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="stageGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.6} />
            <stop offset="33%" stopColor="#a78bfa" stopOpacity={0.6} />
            <stop offset="66%" stopColor="#67e8f9" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          fontSize={11}
          interval={tickInterval}
          tick={{ fill: "oklch(0.708 0 0)" }}
        />
        <YAxis
          yAxisId="stage"
          domain={[0.5, 4.5]}
          ticks={[1, 2, 3, 4]}
          tickFormatter={(v: number) => stageLabels[v] ?? ""}
          fontSize={11}
          tick={{ fill: "oklch(0.708 0 0)" }}
          reversed
          width={40}
        />
        <YAxis
          yAxisId="hr"
          orientation="right"
          fontSize={11}
          tick={{ fill: "oklch(0.708 0 0)" }}
          tickFormatter={(v: number) => `${v}`}
          label={{ value: "bpm", angle: 90, position: "insideRight", style: { fill: "oklch(0.708 0 0)", fontSize: 10 } }}
          width={35}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          yAxisId="stage"
          type="stepAfter"
          dataKey="stage"
          stroke="none"
          fill="url(#stageGradient)"
          fillOpacity={0.4}
        />
        {hr5min && (
          <Line
            yAxisId="hr"
            type="monotone"
            dataKey="hr"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeOpacity={0.6}
            dot={false}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
