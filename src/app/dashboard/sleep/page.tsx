export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  sleepPeriods,
  dailySleep,
  dailyAnalysis,
  dailyReadiness,
  episodeAssessments,
} from "@/lib/db/schema";
import { and, desc, gte, inArray } from "drizzle-orm";
import { SleepCalendar } from "./sleep-calendar";
import type { AnalysisData } from "./night-card";
import {
  buildSleepPageNights,
  SLEEP_PAGE_LOOKBACK_DAYS,
} from "./sleep-page-data";
import {
  loadActiveConfig,
  loadBipolarType,
} from "@/lib/analysis/config";
import {
  currentDailyPatternFields,
  filterCurrentPatternAssessments,
} from "@/lib/analysis/provenance";
import { getTodayET, shiftIsoDay } from "@/lib/date-utils";
import { buildSignals } from "@/lib/health/signals";
import { NIGHT_SLEEP_TYPES } from "@/lib/oura/main-sleep";
import { PageHeader } from "@/components/page-header";

export default async function SleepPage() {
  const today = getTodayET();
  const periodsFrom = shiftIsoDay(today, -SLEEP_PAGE_LOOKBACK_DAYS) ?? today;
  const [
    periodRows,
    scores,
    analysisRows,
    readiness,
    assessmentRows,
    patternConfig,
    bipolarType,
  ] = await Promise.all([
    db
      .select()
      .from(sleepPeriods)
      .where(
        and(
          gte(sleepPeriods.day, periodsFrom),
          inArray(sleepPeriods.type, [...NIGHT_SLEEP_TYPES])
        )
      ),
    db.select().from(dailySleep).orderBy(desc(dailySleep.day)).limit(35),
    // Whole rows: the comparisons with her usual need each baseline.
    db
      .select()
      .from(dailyAnalysis)
      .orderBy(desc(dailyAnalysis.day))
      .limit(35),
    db
      .select({
        day: dailyReadiness.day,
        temperatureDeviation: dailyReadiness.temperatureDeviation,
      })
      .from(dailyReadiness)
      .orderBy(desc(dailyReadiness.day))
      .limit(35),
    db
      .select({
        day: episodeAssessments.day,
        configVersion: episodeAssessments.configVersion,
        bipolarProfile: episodeAssessments.bipolarProfile,
        algorithmVersion: episodeAssessments.algorithmVersion,
        signalMode: episodeAssessments.signalMode,
      })
      .from(episodeAssessments)
      .orderBy(desc(episodeAssessments.day))
      .limit(35),
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
  const analyses = analysisRows.map((row) => ({
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

  const readinessTemperature = new Map(
    readiness.map((row) => [row.day, row.temperatureDeviation])
  );

  const nightsRecord = buildSleepPageNights(periodRows, readinessTemperature);

  const scoresRecord: Record<string, number> = Object.fromEntries(
    scores
      .filter((s) => s.score != null)
      .map((s) => [s.day, s.score as number])
  );

  const threshold = patternConfig.dailyAnomalyThreshold;
  const analysesRecord: Record<string, AnalysisData> = Object.fromEntries(
    analyses.map((a) => {
      const signals = buildSignals(a, threshold);
      return [
        a.day,
        {
          hrvZScore: a.hrvZScore ?? 0,
          sleepDurationZScore: a.sleepDurationZScore ?? 0,
          efficiencyZScore: a.efficiencyZScore ?? 0,
          isAnomaly: a.isAnomaly === 1,
          anomalyDirection: a.anomalyDirection,
          sleep: signals.find((signal) => signal.key === "sleep") ?? null,
          efficiency:
            signals.find((signal) => signal.key === "efficiency") ?? null,
          latency: signals.find((signal) => signal.key === "latency") ?? null,
        },
      ];
    })
  );

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
      <PageHeader title="Sleep Details" description="5-week sleep overview" />

      <SleepCalendar
        nights={nightsRecord}
        scores={scoresRecord}
        analyses={analysesRecord}
        threshold={threshold}
      />
    </div>
  );
}
