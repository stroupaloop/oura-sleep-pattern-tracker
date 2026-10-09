export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  dailyAnalysis,
  episodeAssessments,
  workouts,
  dailyMood,
  sleepPeriods,
} from "@/lib/db/schema";
import { and, gte, inArray, lte } from "drizzle-orm";
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
import {
  presetsFor,
  resolveDateRange,
  type RangeParams,
} from "@/lib/date-range";
import { PageHeader } from "@/components/page-header";
import { DateRangeSelector } from "@/components/ui/date-range-selector";
import { EmptyState } from "@/components/ui/empty-state";

const RANGE_PRESETS = presetsFor(["30d", "90d", "180d", "1y", "all"]);

export default async function InsightsPage({
  searchParams,
}: {
  searchParams?: Promise<RangeParams>;
} = {}) {
  const params = (await searchParams) ?? {};
  const today = getTodayET();
  const requested = resolveDateRange(params, { today, defaultToken: "90d" });
  // All-time has no first day until the rows are read.
  const within = (day: Parameters<typeof gte>[0]) =>
    and(
      requested.start ? gte(day, requested.start) : undefined,
      lte(day, requested.end)
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
      .where(within(dailyAnalysis.day))
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
      .where(within(episodeAssessments.day))
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
      .where(within(workouts.day))
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
      .where(within(dailyMood.day))
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
          within(sleepPeriods.day),
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
  // The rows are ordered by day, so the first is the earliest on record in range.
  const range =
    requested.kind === "all"
      ? resolveDateRange(params, {
          today,
          defaultToken: "90d",
          earliest: analysisRows[0]?.day ?? null,
        })
      : requested;

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <PageHeader
        title="Insights"
        description={
          <>
            Deep analysis of 16+ computed metrics over the dates below.{" "}
            <Link
              href="/dashboard/methodology"
              className="underline hover:text-foreground"
            >
              Learn how we calculate these metrics
            </Link>
          </>
        }
      />

      <DateRangeSelector range={range} presets={RANGE_PRESETS} today={today} />

      {analysis.length === 0 ? (
        <EmptyState title="No analysis data in this range.">
          Try a longer range, or sync your Oura data and run analysis to see
          insights.
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
          range={{
            start: range.start ?? analysisRows[0].day,
            end: range.end,
          }}
          nightDays={[...selectNightSleepByDay(periodRows).keys()]}
        />
      )}
    </div>
  );
}
