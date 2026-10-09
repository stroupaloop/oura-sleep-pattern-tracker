import type { ReactNode } from "react";
import type { DotItemDotProps } from "recharts";
import { cn } from "@/lib/utils";
import { ChartTooltipFrame } from "./chart-tooltip";

/** A chart row; `noNight` marks a day the app has no night for. */
export interface GapRow {
  noNight?: boolean;
}

export function countGaps(rows: ReadonlyArray<GapRow>): number {
  return rows.reduce((count, row) => count + (row.noNight ? 1 : 0), 0);
}

/** Says, under a chart, how many nights are missing from it and how they show. */
export function GapNote({
  rows,
  className,
}: {
  rows: ReadonlyArray<GapRow>;
  className?: string;
}) {
  const count = countGaps(rows);
  if (count === 0) return null;
  return (
    <p className={cn("mt-2 text-xs text-muted-foreground", className)}>
      {count === 1
        ? "1 night has no recording and appears as a gap."
        : `${count} nights have no recording and appear as gaps.`}
    </p>
  );
}

/**
 * Recharts hides a tooltip whose series are all null. A missing night has to
 * speak, so the charts turn that filter off and use this to keep the rest of
 * the behavior: a hover with nothing to show shows nothing.
 */
export function hasValues(payload: ReadonlyArray<{ value?: unknown }>) {
  return payload.some((entry) => entry.value != null);
}

/** The tooltip over a day with no night, in place of values that are not there. */
export function NoNightTooltip({ title }: { title: ReactNode }) {
  return (
    <ChartTooltipFrame title={title}>
      <p className="text-muted-foreground">No night recorded</p>
    </ChartTooltipFrame>
  );
}

/**
 * A line needs a neighbour to be drawn, so a night with a gap or the chart's
 * edge on both sides would vanish. It gets a dot in its series color.
 */
export function isolatedDot({ cx, cy, index, points, stroke }: DotItemDotProps) {
  if (cx == null || cy == null) return null;
  if (points[index - 1]?.y != null || points[index + 1]?.y != null) return null;
  return <circle cx={cx} cy={cy} r={3} fill={stroke} />;
}
