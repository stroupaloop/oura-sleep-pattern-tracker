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
import { GapNote, type GapRow, NoNightTooltip, hasValues } from "./chart-gaps";
import { CHART, legendLabel } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";
import { formatAxisDay, formatNightLabel } from "@/lib/health/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";


interface CompositionData extends GapRow {
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

export function CustomTooltip({
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
  const title = label ? formatNightLabel(label, { weekday: false }) : undefined;
  if (d.noNight) return <NoNightTooltip title={title} />;
  if (!hasValues(payload)) return null;
  return (
    <ChartTooltipFrame title={title}>
      <ChartTooltipRow color={CHART.deep} label="Deep" value={formatStage(d.deep, d.deepMin)} />
      <ChartTooltipRow color={CHART.rem} label="REM" value={formatStage(d.rem, d.remMin)} />
      <ChartTooltipRow color={CHART.light} label="Light" value={formatStage(d.light, d.lightMin)} />
      <ChartTooltipRow color={CHART.awake} label="Awake" value={formatStage(d.awake, d.awakeMin)} />
    </ChartTooltipFrame>
  );
}

/** "Sep 24 – Oct 6": the days the bars cover, which are the tail of the chosen range. */
export function describeCompositionSpan(
  data: ReadonlyArray<{ day: string }>
): string {
  if (data.length === 0) return "";
  const first = formatAxisDay(data[0].day);
  const last = formatAxisDay(data[data.length - 1].day);
  return first === last ? first : `${first} – ${last}`;
}

export function SleepCompositionBar({ data }: { data: CompositionData[] }) {
  const span = describeCompositionSpan(data);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Time in Bed by Stage</CardTitle>
        <CardDescription>
          Each night&apos;s stages and awake time as a share of time in bed
          {span ? `, ${span}` : ""}
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
              allowDataOverflow
              tickFormatter={(v: number) => `${v}%`}
              fontSize={11}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <YAxis
              dataKey="day"
              type="category"
              tickFormatter={(d: string) => formatAxisDay(d)}
              fontSize={11}
              width={64}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <Tooltip content={<CustomTooltip />} filterNull={false} />
            <Legend formatter={legendLabel} />
            <Bar dataKey="deep" stackId="a" fill="var(--stage-deep)" name="Deep" />
            <Bar dataKey="rem" stackId="a" fill="var(--stage-rem)" name="REM" />
            <Bar dataKey="light" stackId="a" fill="var(--stage-light)" name="Light" />
            <Bar dataKey="awake" stackId="a" fill="var(--stage-awake)" name="Awake" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <GapNote rows={data} />
      </CardContent>
    </Card>
  );
}
