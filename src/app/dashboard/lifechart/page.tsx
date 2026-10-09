export const dynamic = "force-dynamic";

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
  presetsFor,
  resolveDateRange,
  type RangeParams,
} from "@/lib/date-range";
import { LifeChart } from "./life-chart";
import { PageHeader } from "@/components/page-header";
import { DateRangeSelector } from "@/components/ui/date-range-selector";
import { EmptyState } from "@/components/ui/empty-state";

interface Props {
  searchParams: Promise<RangeParams>;
}

const RANGE_PRESETS = presetsFor(["30d", "90d", "180d", "1y", "all"]);

export default async function LifeChartPage({ searchParams }: Props) {
  const params = await searchParams;
  const today = getTodayET();
  const requested = resolveDateRange(params, { today, defaultToken: "90d" });
  const endDate = requested.end;
  // All-time has no first day until the rows are read.
  const within = (day: Parameters<typeof gte>[0]) =>
    and(
      requested.start ? gte(day, requested.start) : undefined,
      lte(day, endDate)
    );

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
      .where(within(dailyAnalysis.day))
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
      .where(within(dailyMood.day))
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
      .where(within(episodeAssessments.day))
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
  // The rows are ordered by day, so each one's first row is its earliest.
  const earliest =
    [analysisRows[0]?.day, moods[0]?.day, assessmentRows[0]?.day]
      .filter((day): day is string => Boolean(day))
      .sort()[0] ?? null;
  const range =
    requested.kind === "all"
      ? resolveDateRange(params, { today, defaultToken: "90d", earliest })
      : requested;

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <PageHeader
        title="Life Chart"
        description="Personal mood, sleep, and activity timeline"
      />

      <DateRangeSelector range={range} presets={RANGE_PRESETS} today={today} />

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
