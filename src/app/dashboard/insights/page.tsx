export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  dailyAnalysis,
  episodeAssessments,
  workouts,
  dailyMood,
  sleepPeriods,
} from "@/lib/db/schema";
import { and, gte, inArray } from "drizzle-orm";
import { format, subDays } from "date-fns";
import Link from "next/link";
import { InsightsTabs } from "./insights-tabs";
import { getTodayET } from "@/lib/date-utils";
import {
  NIGHT_SLEEP_TYPES,
  selectNightSleepByDay,
} from "@/lib/oura/main-sleep";
import { normalizeEvidenceScore } from "@/lib/analysis/window";
import {
  loadActiveConfig,
  loadBipolarType,
} from "@/lib/analysis/config";
import {
  currentDailyPatternFields,
  filterCurrentPatternAssessments,
} from "@/lib/analysis/provenance";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default async function InsightsPage() {
  const today = getTodayET();
  const ninetyDaysAgo = format(
    subDays(new Date(`${today}T12:00:00`), 89),
    "yyyy-MM-dd"
  );

  const [
    analysisRows,
    assessmentRows,
    workoutData,
    moodData,
    patternConfig,
    bipolarType,
    periodRows,
  ] = await Promise.all([
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
        deepPct: dailyAnalysis.deepPercentage,
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
        configVersion: episodeAssessments.configVersion,
        bipolarProfile: episodeAssessments.bipolarProfile,
        algorithmVersion: episodeAssessments.algorithmVersion,
        signalMode: episodeAssessments.signalMode,
      })
      .from(episodeAssessments)
      .where(gte(episodeAssessments.day, ninetyDaysAgo))
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
    loadActiveConfig(),
    loadBipolarType(),
    db
      .select({
        day: sleepPeriods.day,
        type: sleepPeriods.type,
        bedtimeStart: sleepPeriods.bedtimeStart,
        bedtimeEnd: sleepPeriods.bedtimeEnd,
        totalSleepDuration: sleepPeriods.totalSleepDuration,
      })
      .from(sleepPeriods)
      .where(
        and(
          gte(sleepPeriods.day, ninetyDaysAgo),
          inArray(sleepPeriods.type, [...NIGHT_SLEEP_TYPES])
        )
      ),
  ]);
  const currentAssessments = filterCurrentPatternAssessments(
    assessmentRows,
    patternConfig.version,
    bipolarType
  );
  const currentAssessmentDays = new Set(
    currentAssessments.map((assessment) => assessment.day)
  );
  const analysis = analysisRows.map((row) => ({
    ...row,
    ...currentDailyPatternFields(
      row.day,
      {
        anomalyScore: row.anomalyScore,
        isAnomaly: row.isAnomaly,
        anomalyDirection: row.anomalyDirection,
      },
      currentAssessmentDays
    ),
  }));
  const episodes = currentAssessments.filter(
    (assessment) => assessment.tier !== "none"
  );

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <PageHeader
        title="Insights"
        description={
          <>
            Deep analysis of 16+ computed metrics from the last 90 days.{" "}
            <Link
              href="/dashboard/methodology"
              className="underline hover:text-foreground"
            >
              Learn how we calculate these metrics
            </Link>
          </>
        }
      />

      {analysis.length === 0 ? (
        <EmptyState title="No analysis data yet.">
          Sync your Oura data and run analysis to see insights.
        </EmptyState>
      ) : (
        <InsightsTabs
          analysis={analysis}
          episodes={episodes.map((episode) => ({
            ...episode,
            confidence: normalizeEvidenceScore(episode.confidence),
          }))}
          workouts={workoutData}
          moods={moodData}
          range={{ start: ninetyDaysAgo, end: today }}
          nightDays={[...selectNightSleepByDay(periodRows).keys()]}
        />
      )}
    </div>
  );
}
