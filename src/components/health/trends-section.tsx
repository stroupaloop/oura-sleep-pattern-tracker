import { formatDuration } from "@/lib/dashboard-metrics";
import type { RangePreset, ResolvedRange } from "@/lib/date-range";
import type { HealthDashboardData } from "@/lib/health/health-dashboard-data";
import { SleepCompositionBar } from "@/components/charts/sleep-composition-bar";
import { SleepTrendChart } from "@/components/charts/sleep-trend-chart";
import { DateRangeSelector } from "@/components/ui/date-range-selector";
import { cn } from "@/lib/utils";

/**
 * Sleep over the days the range covers. The control stays even when the range
 * holds no nights, so a quiet stretch is never a dead end.
 */
export function TrendsSection({
  trends,
  threshold,
  today,
  range,
  presets,
  className,
}: {
  trends: HealthDashboardData["trends"];
  threshold: number;
  today: string;
  range: ResolvedRange;
  presets: readonly RangePreset[];
  className?: string;
}) {
  return (
    <section aria-labelledby="trends" className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="trends" className="text-base font-semibold tracking-tight">
          Trends
        </h2>
        {trends.chartData.length > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Average {formatDuration(trends.averageSleepSeconds)} asleep ·{" "}
            {trends.nightsCounted}{" "}
            {trends.nightsCounted === 1 ? "night" : "nights"} recorded
          </p>
        )}
      </div>
      <DateRangeSelector range={range} presets={presets} today={today} />
      {trends.chartData.length > 0 ? (
        <>
          <SleepTrendChart
            data={trends.chartData}
            analysisData={
              trends.analysisChartData.length > 0
                ? trends.analysisChartData
                : undefined
            }
            windowDays={trends.windowDays}
            threshold={threshold}
          />
          {trends.compositionData.length > 0 && (
            <SleepCompositionBar data={trends.compositionData} />
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No nights recorded in this range. Try a longer one.
        </p>
      )}
    </section>
  );
}
