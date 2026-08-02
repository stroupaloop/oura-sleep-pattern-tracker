export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  sleepPeriods,
  dailySleep,
  dailyAnalysis,
  dailyReadiness,
  episodeAssessments,
} from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import { SleepCalendar } from "./sleep-calendar";
import type { NightData, AnalysisData } from "./night-card";
import { summarizeStoredSamples } from "@/lib/dashboard-metrics";
import {
  loadActiveConfig,
  loadBipolarType,
} from "@/lib/analysis/config";
import {
  currentDailyPatternFields,
  filterCurrentPatternAssessments,
} from "@/lib/analysis/provenance";

export default async function SleepPage() {
  const [
    nights,
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
      .where(sql`${sleepPeriods.type} = 'long_sleep'`)
      .orderBy(desc(sleepPeriods.day))
      .limit(35),
    db.select().from(dailySleep).orderBy(desc(dailySleep.day)).limit(35),
    db
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

  const nightsRecord: Record<string, NightData> = Object.fromEntries(
    nights.map((night) => {
      const heartRate = summarizeStoredSamples(night.hr5min);
      return [
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
          averageHeartRate: heartRate.average ?? night.averageHeartRate,
          lowestHeartRate: heartRate.minimum ?? night.lowestHeartRate,
          averageHrv: night.averageHrv,
          temperatureDelta: readinessTemperature.get(night.day) ?? null,
          hypnogram5min: night.hypnogram5min,
          hr5min: night.hr5min,
        },
      ];
    })
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
