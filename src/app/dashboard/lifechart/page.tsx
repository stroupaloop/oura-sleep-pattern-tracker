export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { db } from "@/lib/db";
import { dailyAnalysis, dailyMood, episodeAssessments } from "@/lib/db/schema";
import { gte, lte, ne, and } from "drizzle-orm";
import { getTodayET } from "@/lib/date-utils";
import {
  getLifeChartStartDay,
  resolveLifeChartRange,
} from "@/lib/life-chart";
import { LifeChart } from "./life-chart";
import { TimeRangeSelector } from "./time-range-selector";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

export default async function LifeChartPage({ searchParams }: Props) {
  const params = await searchParams;
  const rangeDays = resolveLifeChartRange(params.range);
  const endDate = getTodayET();
  const startDate = getLifeChartStartDay(endDate, rangeDays);

  const [analysis, moods, episodes] = await Promise.all([
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
      })
      .from(episodeAssessments)
      .where(
        and(
          ne(episodeAssessments.tier, "none"),
          gte(episodeAssessments.day, startDate),
          lte(episodeAssessments.day, endDate)
        )
      )
      .orderBy(episodeAssessments.day),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Life Chart</h1>
          <p className="text-muted-foreground text-sm mt-1">
            NIMH-style multi-panel timeline
          </p>
        </div>
        <Suspense>
          <TimeRangeSelector />
        </Suspense>
      </div>

      {analysis.length === 0 && moods.length === 0 && episodes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No sleep, mood, or episode data for the selected range.</p>
        </div>
      ) : (
        <LifeChart analysis={analysis} moods={moods} episodes={episodes} />
      )}
    </div>
  );
}
