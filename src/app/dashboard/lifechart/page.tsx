export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { db } from "@/lib/db";
import { dailyAnalysis, dailyMood, episodeAssessments } from "@/lib/db/schema";
import { gte, lte, and } from "drizzle-orm";
import { getTodayET } from "@/lib/date-utils";
import {
  loadActiveConfig,
  loadBipolarType,
} from "@/lib/analysis/config";
import {
  currentDailyPatternFields,
  filterCurrentPatternAssessments,
} from "@/lib/analysis/provenance";
import {
  getLifeChartStartDay,
  resolveLifeChartRange,
} from "@/lib/life-chart";
import { LifeChart } from "./life-chart";
import { TimeRangeSelector } from "./time-range-selector";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

export default async function LifeChartPage({ searchParams }: Props) {
  const params = await searchParams;
  const rangeDays = resolveLifeChartRange(params.range);
  const endDate = getTodayET();
  const startDate = getLifeChartStartDay(endDate, rangeDays);

  const [
    analysisRows,
    moods,
    assessmentRows,
    patternConfig,
    bipolarType,
  ] = await Promise.all([
    db
      .select({
        day: dailyAnalysis.day,
        totalSleepMinutes: dailyAnalysis.totalSleepMinutes,
        baselineSleepMinutes: dailyAnalysis.baselineSleepMinutes,
        anomalyDirection: dailyAnalysis.anomalyDirection,
        isAnomaly: dailyAnalysis.isAnomaly,
        hrvZScore: dailyAnalysis.hrvZScore,
        bedtimeZScore: dailyAnalysis.bedtimeZScore,
        withinNightHrvCV: dailyAnalysis.withinNightHrvCV,
        steps: dailyAnalysis.steps,
      })
      .from(dailyAnalysis)
      .where(
        and(
          gte(dailyAnalysis.day, startDate),
          lte(dailyAnalysis.day, endDate)
        )
      )
      .orderBy(dailyAnalysis.day),
    db
      .select({
        day: dailyMood.day,
        moodScore: dailyMood.moodScore,
        energyScore: dailyMood.energyScore,
        irritabilityScore: dailyMood.irritabilityScore,
        anxietyScore: dailyMood.anxietyScore,
        tags: dailyMood.tags,
        notes: dailyMood.notes,
        episodeState: dailyMood.episodeState,
      })
      .from(dailyMood)
      .where(
        and(gte(dailyMood.day, startDate), lte(dailyMood.day, endDate))
      )
      .orderBy(dailyMood.day),
    db
      .select({
        day: episodeAssessments.day,
        tier: episodeAssessments.tier,
        direction: episodeAssessments.direction,
        configVersion: episodeAssessments.configVersion,
        bipolarProfile: episodeAssessments.bipolarProfile,
        algorithmVersion: episodeAssessments.algorithmVersion,
        signalMode: episodeAssessments.signalMode,
      })
      .from(episodeAssessments)
      .where(
        and(
          gte(episodeAssessments.day, startDate),
          lte(episodeAssessments.day, endDate)
        )
      )
      .orderBy(episodeAssessments.day),
    loadActiveConfig(),
    loadBipolarType(),
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
        title="Life Chart"
        description="Personal mood, sleep, and activity timeline"
        actions={
          <Suspense>
            <TimeRangeSelector />
          </Suspense>
        }
      />

      {analysis.length === 0 && moods.length === 0 && episodes.length === 0 ? (
        <EmptyState title="No sleep, mood, or episode data for the selected range">
          Try a longer range. Nights arrive when the Oura app syncs, and mood
          comes from the daily log.
        </EmptyState>
      ) : (
        <LifeChart
          analysis={analysis}
          moods={moods}
          episodes={episodes}
          threshold={patternConfig.dailyAnomalyThreshold}
        />
      )}
    </div>
  );
}
