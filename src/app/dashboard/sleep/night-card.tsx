"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HypnogramChart } from "@/components/charts/hypnogram-chart";
import { formatIsoTimeInAppTimeZone } from "@/lib/date-utils";

export interface NightData {
  id: string;
  day: string;
  bedtimeStart: string;
  bedtimeEnd: string;
  totalSleepDuration: number | null;
  deepSleepDuration: number | null;
  lightSleepDuration: number | null;
  remSleepDuration: number | null;
  efficiency: number | null;
  latency: number | null;
  restlessPeriods: number | null;
  averageHeartRate: number | null;
  lowestHeartRate: number | null;
  averageHrv: number | null;
  temperatureDelta: number | null;
  hypnogram5min: string | null;
  hr5min: string | null;
}

export interface AnalysisData {
  hrvZScore: number;
  sleepDurationZScore: number;
  efficiencyZScore: number;
  isAnomaly: boolean;
  anomalyDirection: string | null;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "--";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatTime(iso: string): string {
  return formatIsoTimeInAppTimeZone(iso) ?? "--";
}

function pct(part: number | null, total: number | null): string {
  if (part == null || total == null || total === 0) return "--";
  return `${Math.round((part / total) * 100)}%`;
}

type Status = "good" | "fair" | "poor";

function getStatus(value: number | null, good: [number, number], fair: [number, number]): Status | null {
  if (value == null) return null;
  if (value >= good[0] && value <= good[1]) return "good";
  if (value >= fair[0] && value <= fair[1]) return "fair";
  return "poor";
}

const STATUS_STYLE: Record<Status, { color: string; label: string }> = {
  good: { color: "text-green-400", label: "General range" },
  fair: { color: "text-amber-400", label: "Near range" },
  poor: { color: "text-red-400", label: "Outside range" },
};

function StatusBadge({ status }: { status: Status | null }) {
  if (!status) return null;
  const s = STATUS_STYLE[status];
  return <span className={`text-[10px] ${s.color}`}>{s.label}</span>;
}

function MetricNote({ note }: { note: string }) {
  return (
    <p className="text-xs text-amber-400/80 mt-1">
      {note}
    </p>
  );
}

export function NightCardContent({
  night,
  analysis,
}: {
  night: NightData;
  analysis?: AnalysisData;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasHypnogram = !!night.hypnogram5min;

  return (
    <>
      {(() => {
        const totalHrs =
          night.totalSleepDuration != null
            ? night.totalSleepDuration / 3600
            : null;
        const latencyMin =
          night.latency != null ? night.latency / 60 : null;

        const sleepStatus = getStatus(totalHrs, [7, 9], [6, 10]);
        const effStatus = getStatus(
          night.efficiency,
          [85, 100],
          [75, 100]
        );
        const latencyStatus = getStatus(latencyMin, [10, 20], [0, 30]);

        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-muted-foreground">Total Sleep</p>
                  <StatusBadge status={sleepStatus} />
                </div>
                <p className="font-medium text-lg">
                  {formatDuration(night.totalSleepDuration)}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-muted-foreground">Efficiency</p>
                  <StatusBadge status={effStatus} />
                </div>
                <p className="font-medium text-lg">
                  {night.efficiency != null ? `${night.efficiency}%` : "--"}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-muted-foreground">Latency</p>
                  <StatusBadge status={latencyStatus} />
                </div>
                <p className="font-medium text-lg">
                  {latencyMin != null
                    ? `${Math.round(latencyMin)}min`
                    : "--"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Restless</p>
                <p className="font-medium text-lg">
                  {night.restlessPeriods ?? "--"}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Deep</p>
                <p className="font-medium">
                  {formatDuration(night.deepSleepDuration)}{" "}
                  <span className="text-muted-foreground">
                    ({pct(night.deepSleepDuration, night.totalSleepDuration)})
                  </span>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">REM</p>
                <p className="font-medium">
                  {formatDuration(night.remSleepDuration)}{" "}
                  <span className="text-muted-foreground">
                    ({pct(night.remSleepDuration, night.totalSleepDuration)})
                  </span>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Light</p>
                <p className="font-medium">
                  {formatDuration(night.lightSleepDuration)}{" "}
                  <span className="text-muted-foreground">
                    ({pct(night.lightSleepDuration, night.totalSleepDuration)})
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Avg HR</p>
                <p className="font-medium">
                  {night.averageHeartRate?.toFixed(0) ?? "--"} bpm
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Lowest HR</p>
                <p className="font-medium">
                  {night.lowestHeartRate ?? "--"} bpm
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">HRV</p>
                <p className="font-medium">
                  {night.averageHrv?.toFixed(0) ?? "--"} ms
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">
                  Night Temp Deviation
                </p>
                <p className="font-medium">
                  {night.temperatureDelta != null
                    ? `${night.temperatureDelta > 0 ? "+" : ""}${night.temperatureDelta.toFixed(2)} °C`
                    : "--"}
                </p>
              </div>
            </div>
          </>
        );
      })()}

      {analysis?.isAnomaly && (
        <div className="mt-3 space-y-1 border-t pt-3">
          {Math.abs(analysis.hrvZScore) > 2 && (
            <MetricNote
              note={`HRV is well ${analysis.hrvZScore < 0 ? "below" : "above"} your personal baseline. HRV is nonspecific and can change with recovery, stress, illness, alcohol, and other factors.`}
            />
          )}
          {Math.abs(analysis.sleepDurationZScore) > 2 && (
            <MetricNote
              note={`Sleep duration is well ${analysis.sleepDurationZScore < 0 ? "below" : "above"} your personal baseline. Wearable sleep duration alone cannot identify a mood episode.`}
            />
          )}
          {Math.abs(analysis.efficiencyZScore) > 2 && (
            <MetricNote
              note={`Sleep efficiency is well ${analysis.efficiencyZScore < 0 ? "below" : "above"} your personal baseline. Consider the pattern alongside symptoms and other context.`}
            />
          )}
        </div>
      )}

      {hasHypnogram && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {expanded ? "Hide" : "Show"} sleep stages
          </button>
          {expanded && (
            <div className="mt-3">
              <HypnogramChart
                hypnogram={night.hypnogram5min!}
                hr5min={night.hr5min}
                bedtimeStart={night.bedtimeStart}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function NightCard({ night, score, analysis }: { night: NightData; score: number | null; analysis?: AnalysisData }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{night.day}</CardTitle>
          <span className="text-sm font-medium">
            Score: {score ?? "--"}
          </span>
        </div>
        <CardDescription>
          {formatTime(night.bedtimeStart)} — {formatTime(night.bedtimeEnd)} ET
        </CardDescription>
      </CardHeader>
      <CardContent>
        <NightCardContent night={night} analysis={analysis} />
      </CardContent>
    </Card>
  );
}
