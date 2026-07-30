"use client";

import { Button } from "@/components/ui/button";
import type { ReportData, ReportTrend } from "@/lib/reports/generate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function trendArrow(trend: ReportTrend): string | null {
  if (trend === "increasing") return "\u2191";
  if (trend === "decreasing") return "\u2193";
  if (trend === "stable") return "\u2192";
  return null;
}

export function ReportView({ data }: { data: ReportData }) {
  const sleepTrendArrow = trendArrow(data.trends.sleepTrend);
  const hrvTrendArrow = trendArrow(data.trends.hrvTrend);

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div />
        <Button onClick={() => window.print()} variant="outline">
          Print / Export PDF
        </Button>
      </div>

      <div className="print:text-black">
        <h2 className="text-xl font-bold">Bipolar Monitoring Report</h2>
        <p className="text-sm text-muted-foreground print:text-gray-600">
          {data.dateRange.start} to {data.dateRange.end}
        </p>
      </div>

      <Card className="print:border print:shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Summary Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Avg Sleep</p>
              <p className="text-lg font-semibold">
                {data.summary.avgSleepHours != null
                  ? `${data.summary.avgSleepHours.toFixed(1)}h${sleepTrendArrow ? ` ${sleepTrendArrow}` : ""}`
                  : "--"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.summary.sleepDays} measured{" "}
                {data.summary.sleepDays === 1 ? "night" : "nights"}
                {data.trends.sleepTrend === "insufficient_data" &&
                  " · Trend unavailable: fewer than 7 measured nights"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg HRV</p>
              <p className="text-lg font-semibold">
                {data.summary.avgHrv != null
                  ? `${data.summary.avgHrv.toFixed(0)} ms${hrvTrendArrow ? ` ${hrvTrendArrow}` : ""}`
                  : "--"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.summary.hrvDays} measured{" "}
                {data.summary.hrvDays === 1 ? "night" : "nights"}
                {data.trends.hrvTrend === "insufficient_data" &&
                  " · Trend unavailable: fewer than 7 measured nights"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg Steps</p>
              <p className="text-lg font-semibold">
                {data.summary.avgSteps != null
                  ? data.summary.avgSteps.toLocaleString()
                  : "--"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.summary.stepDays} measured days
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Mood Entries</p>
              <p className="text-lg font-semibold">{data.summary.moodEntries}</p>
            </div>
            {data.summary.avgMood != null && (
              <div>
                <p className="text-muted-foreground">Avg Mood</p>
                <p className="text-lg font-semibold">{data.summary.avgMood.toFixed(1)}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Data Coverage</p>
              <p className="text-lg font-semibold">
                {data.summary.totalDays} days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {data.episodes.length > 0 && (
        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Flagged Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.episodes.map((ep, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 text-sm p-2 rounded ${
                    ep.tier === "alert"
                      ? "bg-red-500/10"
                      : ep.tier === "warning"
                        ? "bg-amber-500/10"
                        : "bg-muted"
                  }`}
                >
                  <span className="font-mono text-xs shrink-0">{ep.day}</span>
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      ep.tier === "alert"
                        ? "bg-red-500/20 text-red-300"
                        : ep.tier === "warning"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-blue-500/20 text-blue-300"
                    }`}
                  >
                    {ep.tier.toUpperCase()}
                  </span>
                  {ep.direction && (
                    <span className="text-xs text-muted-foreground">
                      {ep.direction === "hyper"
                        ? "higher-activation pattern"
                        : ep.direction === "hypo"
                          ? "lower-activation pattern"
                          : "mixed pattern"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.medicationAdherence.length > 0 && (
        <Card className="print:border print:shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recorded Dose Adherence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {data.medicationAdherence.map((med, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between">
                    <span>
                      {med.name}
                      {med.asNeeded && (
                        <span className="text-muted-foreground ml-1 text-xs">(as needed)</span>
                      )}
                    </span>
                    {med.asNeeded ? (
                      <span className="text-muted-foreground">
                        {med.taken} recorded {med.taken === 1 ? "use" : "uses"}
                      </span>
                    ) : (
                      <span className={med.rate >= 0.8 ? "text-green-400" : "text-amber-400"}>
                        {med.taken}/{med.total} recorded doses ({(med.rate * 100).toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  {med.unclassifiedLegacyRecords > 0 && (
                    <p className="text-xs text-amber-300">
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
          </CardContent>
        </Card>
      )}

      <Card className="print:border print:shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Data Completeness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Oura Ring Data</span>
              <span>{data.dataCompleteness.ouraDays}/{data.dataCompleteness.totalDays} days ({(data.dataCompleteness.ouraRate * 100).toFixed(0)}%)</span>
            </div>
            <div className="flex justify-between">
              <span>Mood Check-ins</span>
              <span>{data.dataCompleteness.moodDays}/{data.dataCompleteness.totalDays} days ({(data.dataCompleteness.moodRate * 100).toFixed(0)}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground print:text-gray-500">
        This report is generated for personal awareness and discussion with healthcare providers.
        It is not a medical device and does not provide diagnoses. Always consult your healthcare
        provider for medical decisions.
      </p>
    </div>
  );
}
