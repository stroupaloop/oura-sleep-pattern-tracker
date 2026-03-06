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

interface NightData {
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

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function pct(part: number | null, total: number | null): string {
  if (!part || !total || total === 0) return "--";
  return `${Math.round((part / total) * 100)}%`;
}

interface AnalysisData {
  hrvZScore: number;
  sleepDurationZScore: number;
  efficiencyZScore: number;
  isAnomaly: boolean;
  anomalyDirection: string | null;
}

function MetricNote({ label, note }: { label: string; note: string }) {
  return (
    <p className="text-xs text-amber-400/80 mt-1">
      {note}
    </p>
  );
}

export function NightCard({ night, score, analysis }: { night: NightData; score: number | null; analysis?: AnalysisData }) {
  const [expanded, setExpanded] = useState(false);
  const hasHypnogram = !!night.hypnogram5min;

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
          {formatTime(night.bedtimeStart)} — {formatTime(night.bedtimeEnd)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Sleep</p>
            <p className="font-medium text-lg">
              {formatDuration(night.totalSleepDuration)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Efficiency</p>
            <p className="font-medium text-lg">
              {night.efficiency ? `${night.efficiency}%` : "--"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Latency</p>
            <p className="font-medium text-lg">
              {night.latency ? `${Math.round(night.latency / 60)}min` : "--"}
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
            <p className="text-muted-foreground">Temp Delta</p>
            <p className="font-medium">
              {night.temperatureDelta != null
                ? `${night.temperatureDelta > 0 ? "+" : ""}${night.temperatureDelta.toFixed(2)}°`
                : "--"}
            </p>
          </div>
        </div>

        {analysis?.isAnomaly && (
          <div className="mt-3 space-y-1 border-t pt-3">
            {Math.abs(analysis.hrvZScore) > 2 && (
              <MetricNote
                label="HRV"
                note={`HRV is significantly ${analysis.hrvZScore < 0 ? "below" : "above"} your baseline. Changes in HRV can reflect shifts in autonomic nervous system activity. Research shows HRV changes of 17-18% are associated with mood state transitions.`}
              />
            )}
            {Math.abs(analysis.sleepDurationZScore) > 2 && (
              <MetricNote
                label="Sleep"
                note={`Sleep duration is significantly ${analysis.sleepDurationZScore < 0 ? "below" : "above"} your baseline. 69-99% of individuals in manic episodes report reduced sleep need.`}
              />
            )}
            {Math.abs(analysis.efficiencyZScore) > 2 && (
              <MetricNote
                label="Efficiency"
                note={`Sleep efficiency is significantly ${analysis.efficiencyZScore < 0 ? "below" : "above"} your baseline. Persistent sleep disturbance is common across all bipolar stages.`}
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
      </CardContent>
    </Card>
  );
}
