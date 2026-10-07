"use client";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Stat } from "@/components/ui/stat";
import { PatternDirectionLabel } from "@/components/pattern-direction-label";
import { formatMoodValue } from "@/lib/design/mood-scale";
import { tierLabel, tierTone } from "@/lib/design/pattern-tiers";
import { formatIsoDay } from "@/lib/date-utils";
import { formatNightLabel } from "@/lib/health/format";
import type { ReportData, ReportTrend } from "@/lib/reports/generate";

const PRINT_PANEL = "break-inside-avoid";

/** On paper the tier hues are too pale to read; the word carries the tier. */
const PRINT_PILL = "print:bg-transparent print:text-foreground print:ring-border";

function trendArrow(trend: ReportTrend): string | null {
  if (trend === "increasing") return "↑";
  if (trend === "decreasing") return "↓";
  if (trend === "stable") return "→";
  return null;
}

function trendNote(trend: ReportTrend): string {
  if (trend === "increasing") return "rising across the window";
  if (trend === "decreasing") return "falling across the window";
  if (trend === "stable") return "no clear change";
  return "Trend unavailable: fewer than 7 measured nights";
}

function TrendValue({ value, trend }: { value: string; trend: ReportTrend }) {
  const arrow = trendArrow(trend);
  return (
    <>
      {value}
      {arrow && (
        <>
          {" "}
          <span aria-hidden="true">{arrow}</span>
        </>
      )}
    </>
  );
}

function formatDay(day: string): string {
  return formatIsoDay(day) ?? day;
}

export function PrintReportButton() {
  return (
    <Button onClick={() => window.print()} variant="outline">
      Print / Export PDF
    </Button>
  );
}

export function ReportView({ data }: { data: ReportData }) {
  return (
    <div className="space-y-6 print:space-y-4">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Bipolar Monitoring Report
        </h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatDay(data.dateRange.start)} to {formatDay(data.dateRange.end)}
        </p>
      </header>

      <Panel id="report-summary" title="Summary Statistics" className={PRINT_PANEL}>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat
            label="Avg Sleep"
            value={
              data.summary.avgSleepHours != null ? (
                <TrendValue
                  value={`${data.summary.avgSleepHours.toFixed(1)}h`}
                  trend={data.trends.sleepTrend}
                />
              ) : (
                "--"
              )
            }
            note={
              <>
                {data.summary.sleepDays} measured{" "}
                {data.summary.sleepDays === 1 ? "night" : "nights"} ·{" "}
                {trendNote(data.trends.sleepTrend)}
              </>
            }
          />
          <Stat
            label="Avg HRV"
            value={
              data.summary.avgHrv != null ? (
                <TrendValue
                  value={`${data.summary.avgHrv.toFixed(0)} ms`}
                  trend={data.trends.hrvTrend}
                />
              ) : (
                "--"
              )
            }
            note={
              <>
                {data.summary.hrvDays} measured{" "}
                {data.summary.hrvDays === 1 ? "night" : "nights"} ·{" "}
                {trendNote(data.trends.hrvTrend)}
              </>
            }
          />
          <Stat
            label="Avg Steps"
            value={
              data.summary.avgSteps != null
                ? data.summary.avgSteps.toLocaleString()
                : "--"
            }
            note={`${data.summary.stepDays} measured days`}
          />
          <Stat
            label="Mood Entries"
            value={data.summary.moodEntries}
            note={`of ${data.summary.totalDays} days`}
          />
          {data.summary.avgMood != null &&
            data.summary.moodMin != null &&
            data.summary.moodMax != null && (
              <>
                <Stat
                  label="Avg Mood"
                  value={formatMoodValue(
                    Number(data.summary.avgMood.toFixed(1))
                  )}
                  note={`mean of daily ratings, ${formatMoodValue(-3)} to ${formatMoodValue(3)}`}
                />
                <Stat
                  label="Mood Range"
                  value={
                    data.summary.moodMin === data.summary.moodMax
                      ? formatMoodValue(data.summary.moodMin)
                      : `${formatMoodValue(data.summary.moodMin)} to ${formatMoodValue(data.summary.moodMax)}`
                  }
                  note="lowest to highest logged"
                />
                <Stat
                  label={`Days at ${formatMoodValue(2)} or above`}
                  value={data.summary.moodHighDays}
                  note={`of ${data.summary.moodEntries} logged ${data.summary.moodEntries === 1 ? "day" : "days"}`}
                />
                <Stat
                  label={`Days at ${formatMoodValue(-2)} or below`}
                  value={data.summary.moodLowDays}
                  note={`of ${data.summary.moodEntries} logged ${data.summary.moodEntries === 1 ? "day" : "days"}`}
                />
              </>
            )}
          <Stat label="Report Window" value={`${data.summary.totalDays} days`} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Arrows compare the whole window. A rise or fall is shown only when the
          nights drift one way clearly (Mann-Kendall test, p &lt; 0.05) and by
          at least 5% of their typical value (Theil-Sen slope). Otherwise the
          report says no clear change, which does not mean nothing changed.
        </p>
      </Panel>

      {data.episodes.length > 0 && (
        <Panel id="report-flags" title="Flagged Days" className={PRINT_PANEL}>
          <ul className="divide-y">
            {data.episodes.map((ep) => (
              <li
                key={ep.day}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm first:pt-0 last:pb-0"
              >
                <span className="w-32 shrink-0 tabular-nums">
                  {formatNightLabel(ep.day, { weekday: false })}
                </span>
                <Pill tone={tierTone(ep.tier)} className={PRINT_PILL}>
                  {tierLabel(ep.tier)}
                </Pill>
                {ep.direction && (
                  <PatternDirectionLabel
                    direction={ep.direction}
                    className="text-xs text-muted-foreground"
                  />
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {data.medicationAdherence.length > 0 && (
        <Panel
          id="report-adherence"
          title="Recorded Dose Adherence"
          className={PRINT_PANEL}
        >
          <div className="space-y-2 text-sm">
            {data.medicationAdherence.map((med, i) => (
              <div key={i}>
                <div className="flex items-center justify-between gap-3">
                  <span>
                    {med.name}
                    {med.asNeeded && (
                      <span className="text-muted-foreground ml-1 text-xs">(as needed)</span>
                    )}
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {med.asNeeded
                      ? `${med.taken} recorded ${med.taken === 1 ? "use" : "uses"}`
                      : `${med.taken}/${med.total} recorded doses (${(med.rate * 100).toFixed(0)}%)`}
                  </span>
                </div>
                {med.unclassifiedLegacyRecords > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {med.unclassifiedLegacyRecords} legacy{" "}
                    {med.unclassifiedLegacyRecords === 1
                      ? "record has"
                      : "records have"}{" "}
                    an unknown dose-slot classification.
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Scheduled percentages use only explicitly recorded doses. Unlogged
            doses are unknown, not counted as missed.
          </p>
        </Panel>
      )}

      <Panel
        id="report-completeness"
        title="Data Completeness"
        className={PRINT_PANEL}
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <span>Sleep or Step Data</span>
            <span className="text-right tabular-nums">{data.dataCompleteness.ouraDays}/{data.dataCompleteness.totalDays} days ({(data.dataCompleteness.ouraRate * 100).toFixed(0)}%)</span>
          </div>
          <div className="flex justify-between gap-3">
            <span>Mood Check-ins</span>
            <span className="text-right tabular-nums">{data.dataCompleteness.moodDays}/{data.dataCompleteness.totalDays} days ({(data.dataCompleteness.moodRate * 100).toFixed(0)}%)</span>
          </div>
        </div>
      </Panel>

      <p className="text-xs text-muted-foreground">
        This report is generated for personal awareness and discussion with healthcare providers.
        It is not a medical device and does not provide diagnoses. Always consult your healthcare
        provider for medical decisions.
      </p>
    </div>
  );
}
