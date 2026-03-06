export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { sleepPeriods, dailySleep, dailyAnalysis } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { SleepCalendar } from "./sleep-calendar";
import type { NightData, AnalysisData } from "./night-card";

export default async function SleepPage() {
  const nights = await db
    .select()
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(desc(sleepPeriods.day))
    .limit(35);

  const scores = await db
    .select()
    .from(dailySleep)
    .orderBy(desc(dailySleep.day))
    .limit(35);

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
    .limit(35);

  const nightsRecord: Record<string, NightData> = Object.fromEntries(
    nights.map((night) => [
      night.day,
      {
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
      },
    ])
  );

  const scoresRecord: Record<string, number> = Object.fromEntries(
    scores
      .filter((s) => s.score != null)
      .map((s) => [s.day, s.score as number])
  );

  const analysesRecord: Record<string, AnalysisData> = Object.fromEntries(
    analyses.map((a) => [
      a.day,
      {
        hrvZScore: a.hrvZScore ?? 0,
        sleepDurationZScore: a.sleepDurationZScore ?? 0,
        efficiencyZScore: a.efficiencyZScore ?? 0,
        isAnomaly: a.isAnomaly === 1,
        anomalyDirection: a.anomalyDirection,
      },
    ])
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Sleep Details</h1>
      <p className="text-muted-foreground">
        5-week sleep overview
      </p>

      <SleepCalendar
        nights={nightsRecord}
        scores={scoresRecord}
        analyses={analysesRecord}
      />
    </div>
  );
}
