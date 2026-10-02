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


/** Series colors carry the swatches; the labels stay readable text. */
function legendLabel(value: string) {
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

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

export function formatMins(mins: number | null): string {
  if (mins == null || !Number.isFinite(mins)) return "--";
  // Round once, so 119.5 minutes reads "2h 0m", never "1h 60m".
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
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
      <p style={{ color: "var(--stage-deep)" }}>
        Deep: {formatStage(d.deep, d.deepMin)}
      </p>
      <p style={{ color: "var(--stage-rem)" }}>
        REM: {formatStage(d.rem, d.remMin)}
      </p>
      <p style={{ color: "var(--stage-light)" }}>
        Light: {formatStage(d.light, d.lightMin)}
      </p>
      <p style={{ color: "var(--stage-awake)" }}>
        Awake: {formatStage(d.awake, d.awakeMin)}
      </p>
    </div>
  );
}

export function SleepCompositionBar({ data }: { data: CompositionData[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Time in Bed by Stage</CardTitle>
        <CardDescription>
          Each night&apos;s stages and awake time as a share of time in bed,
          last {data.length} nights
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
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <YAxis
              dataKey="day"
              type="category"
              tickFormatter={(d: string) => d.slice(5)}
              fontSize={11}
              width={50}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={legendLabel} />
            <Bar dataKey="deep" stackId="a" fill="var(--stage-deep)" name="Deep" />
            <Bar dataKey="rem" stackId="a" fill="var(--stage-rem)" name="REM" />
            <Bar dataKey="light" stackId="a" fill="var(--stage-light)" name="Light" />
            <Bar dataKey="awake" stackId="a" fill="var(--stage-awake)" name="Awake" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
