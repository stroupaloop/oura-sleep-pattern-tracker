"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
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
  deep: number;
  rem: number;
  light: number;
  awake: number;
  deepMin: number;
  remMin: number;
  lightMin: number;
  awakeMin: number;
}

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
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
        Deep: {d.deep.toFixed(0)}% ({formatMins(d.deepMin)})
      </p>
      <p style={{ color: "#a78bfa" }}>
        REM: {d.rem.toFixed(0)}% ({formatMins(d.remMin)})
      </p>
      <p style={{ color: "#67e8f9" }}>
        Light: {d.light.toFixed(0)}% ({formatMins(d.lightMin)})
      </p>
      <p style={{ color: "#f97316" }}>
        Awake: {d.awake.toFixed(0)}% ({formatMins(d.awakeMin)})
      </p>
    </div>
  );
}

export function SleepCompositionBar({ data }: { data: CompositionData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sleep Stage Composition</CardTitle>
        <CardDescription>
          Nightly sleep stage proportions (last {data.length} nights)
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
            <ReferenceLine x={17.5} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.4} />
            <ReferenceLine x={40} stroke="#a78bfa" strokeDasharray="3 3" strokeOpacity={0.4} />
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
