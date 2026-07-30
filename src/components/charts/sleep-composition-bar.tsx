"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
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

interface CompositionData {
  day: string;
  deep: number | null;
  rem: number | null;
  light: number | null;
  awake: number | null;
  deepMin: number | null;
  remMin: number | null;
  lightMin: number | null;
  awakeMin: number | null;
}

function formatMins(mins: number | null): string {
  if (mins == null) return "--";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatStage(percent: number | null, minutes: number | null): string {
  if (percent == null || minutes == null) return "--";
  return `${percent.toFixed(0)}% (${formatMins(minutes)})`;
}

interface TooltipPayloadItem {
  name: string;
  value: number | null;
  color: string;
  payload: CompositionData;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground mb-1">{label}</p>
      <p style={{ color: "#3b82f6" }}>
        Deep: {formatStage(d.deep, d.deepMin)}
      </p>
      <p style={{ color: "#a78bfa" }}>
        REM: {formatStage(d.rem, d.remMin)}
      </p>
      <p style={{ color: "#67e8f9" }}>
        Light: {formatStage(d.light, d.lightMin)}
      </p>
      <p style={{ color: "#f97316" }}>
        Awake: {formatStage(d.awake, d.awakeMin)}
      </p>
    </div>
  );
}

export function SleepCompositionBar({ data }: { data: CompositionData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Time-in-Bed Composition</CardTitle>
        <CardDescription>
          Sleep stages plus awake time as a share of time in bed (last {data.length} nights)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, data.length * 28)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              fontSize={11}
              tick={{ fill: "oklch(0.708 0 0)" }}
            />
            <YAxis
              dataKey="day"
              type="category"
              tickFormatter={(d: string) => d.slice(5)}
              fontSize={11}
              width={50}
              tick={{ fill: "oklch(0.708 0 0)" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="deep" stackId="a" fill="#3b82f6" name="Deep" />
            <Bar dataKey="rem" stackId="a" fill="#a78bfa" name="REM" />
            <Bar dataKey="light" stackId="a" fill="#67e8f9" name="Light" />
            <Bar dataKey="awake" stackId="a" fill="#f97316" name="Awake" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
