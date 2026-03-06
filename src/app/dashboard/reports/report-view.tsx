"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ReportData {
  dateRange: { start: string; end: string };
  summary: {
    totalDays: number;
    avgSleepHours: number;
    avgHrv: number;
    avgSteps: number;
    moodEntries: number;
    avgMood: number | null;
  };
  trends: {
    sleepTrend: string;
    hrvTrend: string;
  };
  episodes: {
    day: string;
    tier: string;
    direction: string | null;
    confidence: number;
    summary: string | null;
  }[];
  medicationAdherence: {
    name: string;
    taken: number;
    total: number;
    rate: number;
  }[];
  dataCompleteness: {
    ouraDays: number;
    moodDays: number;
    totalDays: number;
    ouraRate: number;
    moodRate: number;
  };
}

function trendArrow(trend: string): string {
  if (trend === "improving") return "\u2191";
  if (trend === "worsening") return "\u2193";
  return "\u2192";
}

export function ReportView({ data }: { data: ReportData }) {
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
                {data.summary.avgSleepHours.toFixed(1)}h {trendArrow(data.trends.sleepTrend)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg HRV</p>
              <p className="text-lg font-semibold">
                {data.summary.avgHrv.toFixed(0)} ms {trendArrow(data.trends.hrvTrend)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg Steps</p>
              <p className="text-lg font-semibold">{data.summary.avgSteps.toLocaleString()}</p>
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
            <CardTitle className="text-base">Episodes Detected</CardTitle>
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
                    <span className="text-xs text-muted-foreground">{ep.direction}</span>
                  )}
                  {ep.summary && (
                    <span className="text-muted-foreground">{ep.summary}</span>
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
            <CardTitle className="text-base">Medication Adherence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {data.medicationAdherence.map((med, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span>{med.name}</span>
                  <span className={med.rate >= 0.8 ? "text-green-400" : "text-amber-400"}>
                    {med.taken}/{med.total} ({(med.rate * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
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
