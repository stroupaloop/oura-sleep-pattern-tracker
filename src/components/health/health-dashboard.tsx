import { formatDuration } from "@/lib/dashboard-metrics";
import { formatNightLabel, formatSyncedAt } from "@/lib/health/format";
import type { HealthDashboardData } from "@/lib/health/health-dashboard-data";
import type { loadDailyLog } from "@/lib/daily-log-data";
import { DailyLogCard } from "@/components/daily-log-card";
import { DataAvailabilityCard } from "@/components/confidence-indicator";
import { HypnogramChart } from "@/components/charts/hypnogram-chart";
import { SleepCompositionBar } from "@/components/charts/sleep-composition-bar";
import { SleepTrendChart } from "@/components/charts/sleep-trend-chart";
import { MissingNightNotice } from "./missing-night-notice";
import { NightPanel } from "./night-panel";
import { Panel } from "@/components/ui/panel";
import { PatternStatus } from "@/components/pattern-status";
import { ScorePanel } from "./score-panel";
import { SignalList } from "./signal-list";
import { SyncNowButton } from "./sync-now-button";

/**
 * Last night first, measured against her usual, then the pattern check, the
 * day's log and the longer view. On a phone the sections stack in that
 * order; on a wide screen the log and the summaries move to a side rail.
 */
export function HealthDashboard({
  data,
  dailyLog,
  canSync,
  paused,
  morning,
}: {
  data: HealthDashboardData;
  dailyLog: Awaited<ReturnType<typeof loadDailyLog>>;
  canSync: boolean;
  /** The Oura connection is failing; the layout banner already says so. */
  paused: boolean;
  /** Before noon ET, when last night may simply not have synced yet. */
  morning: boolean;
}) {
  // The night panel names the night in full; the rest say it briefly.
  const nightLabel = data.shownDay
    ? formatNightLabel(data.shownDay, { weekday: false })
    : null;
  const syncedAt = data.connection?.lastSyncedAt ?? null;
  const { trends } = data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8">
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
        <header className="order-1 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Health
            </h1>
            <p className="text-sm text-muted-foreground tabular-nums">
              {syncedAt
                ? `Oura synced ${formatSyncedAt(syncedAt, data.today)}`
                : "Oura hasn't synced yet"}
            </p>
          </div>
          {canSync && <SyncNowButton latestNight={data.shownDay} />}
        </header>

        {!data.isLastNight && !paused && (
          <MissingNightNotice
            className="order-1"
            morning={morning}
            canSync={canSync}
            hasEarlierNight={data.night != null}
          />
        )}

        {data.night ? (
          <NightPanel data={data} className="order-2" />
        ) : (
          <Panel
            id="night"
            title="Nights"
            className="order-2"
            description={`No nights recorded in the last ${trends.windowDays} days. Once the ring is worn overnight and the Oura app syncs, they appear here.`}
          >
            <p className="text-sm text-muted-foreground">
              Data coverage below shows what has arrived.
            </p>
          </Panel>
        )}

        <Panel
          id="signals"
          title="Compared with the usual"
          description="Against the usual range over the past 30 nights. Sleep and its timing come first: they tend to move earliest."
          meta={nightLabel ?? undefined}
          className="order-4"
        >
          {data.signals.length > 0 ? (
            <SignalList signals={data.signals} threshold={data.threshold} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {data.night
                ? "This night hasn't been compared yet. Comparisons start once there are 14 nights of baseline, and appear after the next sync."
                : "Comparisons appear once nights are recorded."}
            </p>
          )}
        </Panel>

        <Panel
          id="stages"
          title="Sleep stages"
          meta={nightLabel ?? undefined}
          description={
            data.night && data.night.periodCount > 1
              ? "The longest stretch of the night, with heart rate. ET."
              : "With heart rate overlaid. ET."
          }
          className="order-7"
        >
          {data.night?.main.hypnogram5min ? (
            <HypnogramChart
              hypnogram={data.night.main.hypnogram5min}
              hr5min={data.night.main.hr5min}
              bedtimeStart={data.night.main.bedtimeStart}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No sleep-stage record for this night. Earlier nights stay
              available in the trends below.
            </p>
          )}
        </Panel>

        {trends.chartData.length > 0 && (
          <section aria-labelledby="trends" className="order-8 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="trends" className="text-base font-semibold tracking-tight">
                Last {trends.windowDays} days
              </h2>
              <p className="text-xs text-muted-foreground tabular-nums">
                Average {formatDuration(trends.averageSleepSeconds)} asleep ·{" "}
                {trends.nightsCounted}{" "}
                {trends.nightsCounted === 1 ? "night" : "nights"} recorded
              </p>
            </div>
            <SleepTrendChart
              data={trends.chartData}
              analysisData={
                trends.analysisChartData.length > 0
                  ? trends.analysisChartData
                  : undefined
              }
              windowDays={trends.windowDays}
              threshold={data.threshold}
            />
            {trends.compositionData.length > 0 && (
              <SleepCompositionBar data={trends.compositionData} />
            )}
          </section>
        )}
      </div>

      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
        <PatternStatus
          pattern={data.pattern}
          latestCheckedDay={data.latestCheckedDay}
          paused={paused}
          canSync={canSync}
          today={data.today}
          className="order-3"
        />
        <div className="order-5">
          <DailyLogCard
            initialDay={data.today}
            medications={dailyLog.medications}
            initialMood={dailyLog.mood}
            initialMedLogs={dailyLog.medLogs}
            dense
          />
        </div>
        <ScorePanel
          sleep={data.scores.sleep}
          readiness={data.scores.readiness}
          nightLabel={nightLabel}
          className="order-6"
        />
        <DataAvailabilityCard
          data={data.availability}
          missingScopes={data.missingScopes}
          className="order-9"
        />
      </div>
    </div>
  );
}
