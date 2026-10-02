import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/dashboard-metrics";
import { formatNightLabel } from "@/lib/health/format";
import type { HealthDashboardData } from "@/lib/health/health-dashboard-data";
import { ResearchTooltip } from "@/components/research-tooltip";
import { NightWindowChart } from "./night-window-chart";
import { Panel } from "./panel";

export function NightPanel({
  data,
  className,
}: {
  data: HealthDashboardData;
  className?: string;
}) {
  const { night, shownDay } = data;
  if (!night || !shownDay) return null;

  const sleep = data.signals.find((signal) => signal.key === "sleep");
  const window = night.window;

  return (
    <Panel
      id="night"
      title={data.isLastNight ? "Last night" : "Latest night"}
      meta={formatNightLabel(shownDay)}
      className={className}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <p className="text-4xl font-semibold tracking-tight tabular-nums">
          {formatDuration(night.totalSleepSeconds)}
          <span className="ml-2 text-base font-normal tracking-normal text-muted-foreground">
            asleep
          </span>
        </p>
        {window && (
          <p className="text-sm text-muted-foreground tabular-nums">
            {window.bedtimeLabel} → {window.wakeLabel}
          </p>
        )}
      </div>
      <p
        className={cn(
          "mt-1 text-sm",
          sleep?.level === "unusual" ? "text-attention" : "text-muted-foreground"
        )}
      >
        {sleep
          ? `${sleep.comparison}${
              sleep.usualValue && sleep.comparison !== "About usual"
                ? ` · usual ${sleep.usualValue}`
                : ""
            }`
          : "No baseline comparison for this night yet"}
        <ResearchTooltip metric="sleepDuration" />
      </p>

      {window && (
        <div className="mt-5">
          <NightWindowChart window={window} />
        </div>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Time in bed</dt>
          <dd className="text-sm font-medium tabular-nums">
            {formatDuration(night.timeInBedSeconds)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Efficiency</dt>
          <dd className="text-sm font-medium tabular-nums">
            {night.efficiency != null ? `${Math.round(night.efficiency)}%` : "--"}
          </dd>
        </div>
        {night.periodCount > 1 && (
          <div>
            <dt className="text-xs text-muted-foreground">Sleep came in</dt>
            <dd className="text-sm font-medium tabular-nums">
              {night.periodCount} stretches
            </dd>
          </div>
        )}
      </dl>
    </Panel>
  );
}
