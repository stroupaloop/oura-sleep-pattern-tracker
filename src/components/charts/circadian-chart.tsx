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
  ReferenceLine,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResearchTooltip } from "@/components/research-tooltip";
import { tierColor, tierLabel } from "@/lib/design/pattern-tiers";
import {
  GapNote,
  type GapRow,
  NoNightTooltip,
  hasValues,
  isolatedDot,
} from "./chart-gaps";
import { AXIS_TICK, CHART, legendLabel } from "./chart-theme";
import { ChartTooltipFrame, ChartTooltipRow } from "./chart-tooltip";

interface CircadianPoint extends GapRow {
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

/** None of these is HRV or heart rate, so they stay neutral: Moonlight, Mist dashed, Haze dotted. */
const SERIES = {
  is: { color: "var(--foreground)", dash: undefined },
  iv: { color: CHART.axis, dash: "6 4" },
  ra: { color: "var(--faint-foreground)", dash: "2 3" },
} as const;

export function CircadianTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; payload: CircadianPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  if (p.noNight) return <NoNightTooltip title={p.day} />;
  if (!hasValues(payload)) return null;
  return (
    <ChartTooltipFrame title={p.day}>
      {p.is != null && (
        <ChartTooltipRow
          color={SERIES.is.color}
          label="IS (Stability)"
          value={p.is.toFixed(3)}
        />
      )}
      {p.iv != null && (
        <ChartTooltipRow
          color={SERIES.iv.color}
          label="IV (Variability)"
          value={p.iv.toFixed(3)}
        />
      )}
      {p.ra != null && (
        <ChartTooltipRow
          color={SERIES.ra.color}
          label="RA (Amplitude)"
          value={p.ra.toFixed(3)}
        />
      )}
      {p.isEpisode && (
        <ChartTooltipRow
          color={tierColor(p.episodeTier)}
          label="Pattern flag"
          value={tierLabel(p.episodeTier)}
        />
      )}
    </ChartTooltipFrame>
  );
}

export function CircadianChart({ data, limitations }: CircadianChartProps) {
  const hasCircadianData = data.some(
    (point) => point.is != null || point.iv != null || point.ra != null
  );
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
          Personal activity-rhythm trends · IS and RA use 0–1; IV uses a
          separate scale
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4 max-w-prose text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Direction:</span>{" "}
          IS ↑ more stable · IV ↑ more fragmented · RA ↑ stronger day/rest
          contrast. Compare sustained changes with your own history.
        </p>
        {!hasCircadianData ? (
          <div className="flex min-h-56 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
            No eligible circadian metric is available yet. IS needs 3
            consecutive activity days; these metrics require at least 80%
            classified intervals.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
            <XAxis
              dataKey="day"
              tickFormatter={(d) => d.slice(5)}
              tick={AXIS_TICK}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="bounded"
              domain={[0, 1]}
              tick={AXIS_TICK}
              label={{
                value: "IS / RA",
                angle: -90,
                position: "insideLeft",
                fontSize: AXIS_TICK.fontSize,
                fill: CHART.axis,
              }}
            />
            <YAxis
              yAxisId="iv"
              orientation="right"
              domain={[0, "auto"]}
              tick={AXIS_TICK}
              label={{
                value: "IV",
                angle: 90,
                position: "insideRight",
                fontSize: AXIS_TICK.fontSize,
                fill: CHART.axis,
              }}
            />
            <Tooltip content={<CircadianTooltipContent />} filterNull={false} />
            <Legend formatter={legendLabel} />
            {episodeRanges.map((r, i) => (
              <ReferenceArea
                key={i}
                yAxisId="bounded"
                x1={r.start}
                x2={r.end}
                fill={tierColor(r.tier)}
                fillOpacity={0.1}
              />
            ))}
            <ReferenceLine
              yAxisId="iv"
              y={2}
              stroke={SERIES.iv.color}
              strokeDasharray="3 3"
              strokeOpacity={0.5}
              ifOverflow="extendDomain"
              label={{
                value: "IV 2.0 reference",
                position: "insideTopRight",
                fill: CHART.axis,
                fontSize: AXIS_TICK.fontSize,
              }}
            />
            <Line
              yAxisId="bounded"
              type="monotone"
              dataKey="is"
              stroke={SERIES.is.color}
              strokeWidth={2}
              dot={isolatedDot}
              name="IS (Stability)"
              connectNulls={false}
            />
            <Line
              yAxisId="iv"
              type="monotone"
              dataKey="iv"
              stroke={SERIES.iv.color}
              strokeDasharray={SERIES.iv.dash}
              strokeWidth={2}
              dot={isolatedDot}
              name="IV (Variability)"
              connectNulls={false}
            />
            <Line
              yAxisId="bounded"
              type="monotone"
              dataKey="ra"
              stroke={SERIES.ra.color}
              strokeDasharray={SERIES.ra.dash}
              strokeWidth={2}
              dot={isolatedDot}
              name="RA (Amplitude)"
              connectNulls={false}
            />
            </LineChart>
          </ResponsiveContainer>
        )}
        {hasCircadianData && <GapNote rows={data} />}
        {hasCircadianData && (
          <p className="mt-2 text-xs text-muted-foreground">
            The IV 2.0 line is a mathematical reference, not a clinical cutoff.
          </p>
        )}
        {limitations && (
          <p className="text-xs text-muted-foreground mt-2">{limitations}</p>
        )}
      </CardContent>
    </Card>
  );
}
