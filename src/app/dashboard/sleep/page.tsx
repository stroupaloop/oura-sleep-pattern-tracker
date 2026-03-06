export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { sleepPeriods, dailySleep, dailyAnalysis } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NightCard } from "./night-card";

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

export default async function SleepPage() {
  const nights = await db
    .select()
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(desc(sleepPeriods.day))
    .limit(30);

  const scores = await db
    .select()
    .from(dailySleep)
    .orderBy(desc(dailySleep.day))
    .limit(30);

  const scoreMap = new Map(scores.map((s) => [s.day, s.score]));

  const analyses = await db
    .select({
      day: dailyAnalysis.day,
      hrvZScore: dailyAnalysis.hrvZScore,
      sleepDurationZScore: dailyAnalysis.sleepDurationZScore,
      efficiencyZScore: dailyAnalysis.efficiencyZScore,
      isAnomaly: dailyAnalysis.isAnomaly,
      anomalyDirection: dailyAnalysis.anomalyDirection,
    })
    .from(dailyAnalysis)
    .orderBy(desc(dailyAnalysis.day))
    .limit(30);

  const analysisMap = new Map(analyses.map((a) => [a.day, a]));

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Sleep Details</h1>
      <p className="text-muted-foreground">
        Nightly breakdown for the last {nights.length} nights
      </p>

      {nights.map((night) => {
        const analysis = analysisMap.get(night.day);
        return (
          <NightCard
            key={night.id}
            night={{
              id: night.id,
              day: night.day,
              bedtimeStart: night.bedtimeStart,
              bedtimeEnd: night.bedtimeEnd,
              totalSleepDuration: night.totalSleepDuration,
              deepSleepDuration: night.deepSleepDuration,
              lightSleepDuration: night.lightSleepDuration,
              remSleepDuration: night.remSleepDuration,
              efficiency: night.efficiency,
              latency: night.latency,
              restlessPeriods: night.restlessPeriods,
              averageHeartRate: night.averageHeartRate,
              lowestHeartRate: night.lowestHeartRate,
              averageHrv: night.averageHrv,
              temperatureDelta: night.temperatureDelta,
              hypnogram5min: night.hypnogram5min,
              hr5min: night.hr5min,
            }}
            score={scoreMap.get(night.day) ?? null}
            analysis={analysis ? {
              hrvZScore: analysis.hrvZScore ?? 0,
              sleepDurationZScore: analysis.sleepDurationZScore ?? 0,
              efficiencyZScore: analysis.efficiencyZScore ?? 0,
              isAnomaly: analysis.isAnomaly === 1,
              anomalyDirection: analysis.anomalyDirection,
            } : undefined}
          />
        );
      })}
    </div>
  );
}
