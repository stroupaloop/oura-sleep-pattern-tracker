export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { dailyAnalysis, episodeAssessments, workouts, dailyMood } from "@/lib/db/schema";
import { desc, gte, ne, and } from "drizzle-orm";
import { format, subDays } from "date-fns";
import Link from "next/link";
import { InsightsTabs } from "./insights-tabs";

export default async function InsightsPage() {
  const ninetyDaysAgo = format(subDays(new Date(), 90), "yyyy-MM-dd");

  const [analysis, episodes, workoutData, moodData] = await Promise.all([
    db
      .select({
        day: dailyAnalysis.day,
        circadianIS: dailyAnalysis.circadianIS,
        circadianIV: dailyAnalysis.circadianIV,
        circadianRA: dailyAnalysis.circadianRA,
        steps: dailyAnalysis.steps,
        activeMinutes: dailyAnalysis.activeMinutes,
        stressHigh: dailyAnalysis.stressHigh,
        recoveryHigh: dailyAnalysis.recoveryHigh,
        resilienceLevel: dailyAnalysis.resilienceLevel,
        dayToDaySleepCV: dailyAnalysis.dayToDaySleepCV,
        dayToDayBedtimeCV: dailyAnalysis.dayToDayBedtimeCV,
        dayToDayWakeCV: dailyAnalysis.dayToDayWakeCV,
        withinNightHrvCV: dailyAnalysis.withinNightHrvCV,
        withinNightHrCV: dailyAnalysis.withinNightHrCV,
        hypnogramFragmentation: dailyAnalysis.hypnogramFragmentation,
        avgHrv: dailyAnalysis.avgHrv,
        efficiency: dailyAnalysis.efficiency,
        anomalyScore: dailyAnalysis.anomalyScore,
        anomalyDirection: dailyAnalysis.anomalyDirection,
        isAnomaly: dailyAnalysis.isAnomaly,
        totalSleepMinutes: dailyAnalysis.totalSleepMinutes,
        moodScore: dailyAnalysis.moodScore,
        energyScore: dailyAnalysis.energyScore,
        irritabilityScore: dailyAnalysis.irritabilityScore,
        anxietyScore: dailyAnalysis.anxietyScore,
      })
      .from(dailyAnalysis)
      .where(gte(dailyAnalysis.day, ninetyDaysAgo))
      .orderBy(dailyAnalysis.day),
    db
      .select({
        day: episodeAssessments.day,
        tier: episodeAssessments.tier,
        direction: episodeAssessments.direction,
        confidence: episodeAssessments.confidence,
      })
      .from(episodeAssessments)
      .where(
        and(
          ne(episodeAssessments.tier, "none"),
          gte(episodeAssessments.day, ninetyDaysAgo)
        )
      )
      .orderBy(episodeAssessments.day),
    db
      .select({
        day: workouts.day,
        activity: workouts.activity,
        calories: workouts.calories,
        distance: workouts.distance,
        intensity: workouts.intensity,
        startDatetime: workouts.startDatetime,
        endDatetime: workouts.endDatetime,
      })
      .from(workouts)
      .where(gte(workouts.day, ninetyDaysAgo))
      .orderBy(workouts.day),
    db
      .select({
        day: dailyMood.day,
        moodScore: dailyMood.moodScore,
        energyScore: dailyMood.energyScore,
        irritabilityScore: dailyMood.irritabilityScore,
        anxietyScore: dailyMood.anxietyScore,
      })
      .from(dailyMood)
      .where(gte(dailyMood.day, ninetyDaysAgo))
      .orderBy(dailyMood.day),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Insights</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Deep analysis of 16+ computed metrics from the last 90 days.{" "}
          <Link
            href="/dashboard/methodology"
            className="underline hover:text-foreground"
          >
            Learn how we calculate these metrics
          </Link>
        </p>
      </div>

      {analysis.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No analysis data yet. Sync your Oura data and run analysis to see insights.</p>
        </div>
      ) : (
        <InsightsTabs analysis={analysis} episodes={episodes} workouts={workoutData} moods={moodData} />
      )}
    </div>
  );
}
