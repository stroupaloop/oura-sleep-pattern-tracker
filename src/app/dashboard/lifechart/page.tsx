export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { db } from "@/lib/db";
import { dailyAnalysis, dailyMood, episodeAssessments } from "@/lib/db/schema";
import { gte, ne, and } from "drizzle-orm";
import { format, subDays } from "date-fns";
import { LifeChart } from "./life-chart";
import { TimeRangeSelector } from "./time-range-selector";

interface Props {
  searchParams: Promise<{ range?: string }>;
}

export default async function LifeChartPage({ searchParams }: Props) {
  const params = await searchParams;
  const rangeDays = Number(params.range) || 90;
  const startDate = format(subDays(new Date(), rangeDays), "yyyy-MM-dd");

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
      .where(gte(dailyAnalysis.day, startDate))
      .orderBy(dailyAnalysis.day),
    db
      .select({
        day: dailyMood.day,
        moodScore: dailyMood.moodScore,
        tags: dailyMood.tags,
      })
      .from(dailyMood)
      .where(gte(dailyMood.day, startDate))
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
          gte(episodeAssessments.day, startDate)
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

      {analysis.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No data for the selected range. Sync your Oura data and run analysis first.</p>
        </div>
      ) : (
        <LifeChart analysis={analysis} moods={moods} episodes={episodes} />
      )}
    </div>
  );
}
