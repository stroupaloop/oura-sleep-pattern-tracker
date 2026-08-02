import { db } from "@/lib/db";
import {
  dailyActivity,
  dailyMood,
  episodeAssessments,
  medicationLogs,
  medications,
  sleepPeriods,
} from "@/lib/db/schema";
import { gte, lte, and, desc, eq } from "drizzle-orm";
import {
  loadActiveConfig,
  loadBipolarType,
} from "@/lib/analysis/config";
import { filterCurrentPatternAssessments } from "@/lib/analysis/provenance";
import { summarizeRecordedMedicationLogs } from "./medication-adherence";

export type ReportTrend =
  | "increasing"
  | "decreasing"
  | "stable"
  | "insufficient_data";

export interface ReportData {
  dateRange: { start: string; end: string };
  summary: {
    totalDays: number;
    avgSleepHours: number | null;
    avgHrv: number | null;
    avgSteps: number | null;
    sleepDays: number;
    hrvDays: number;
    stepDays: number;
    moodEntries: number;
    avgMood: number | null;
  };
  trends: {
    sleepTrend: ReportTrend;
    hrvTrend: ReportTrend;
  };
  episodes: {
    day: string;
    tier: string;
    direction: string | null;
  }[];
  medicationAdherence: {
    name: string;
    taken: number;
    total: number;
    rate: number;
    asNeeded: boolean;
    unclassifiedLegacyRecords: number;
  }[];
  dataCompleteness: {
    ouraDays: number;
    moodDays: number;
    totalDays: number;
    ouraRate: number;
    moodRate: number;
  };
}

export function computeTrend(values: number[]): ReportTrend {
  if (values.length < 7) return "insufficient_data";
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = (avg2 - avg1) / avg1;
  if (Math.abs(diff) < 0.05) return "stable";
  return diff > 0 ? "increasing" : "decreasing";
}

export async function generateReport(
  startDate: string,
  endDate: string
): Promise<ReportData> {
  const [
    sleepRows,
    activityRows,
    moodRows,
    assessmentRows,
    medRows,
    medLogRows,
    patternConfig,
    bipolarType,
  ] = await Promise.all([
    db
      .select({
        day: sleepPeriods.day,
        totalSleepSeconds: sleepPeriods.totalSleepDuration,
        avgHrv: sleepPeriods.averageHrv,
      })
      .from(sleepPeriods)
      .where(
        and(
          eq(sleepPeriods.type, "long_sleep"),
          gte(sleepPeriods.day, startDate),
          lte(sleepPeriods.day, endDate)
        )
      )
      .orderBy(sleepPeriods.day),
    db
      .select({
        day: dailyActivity.day,
        steps: dailyActivity.steps,
      })
      .from(dailyActivity)
      .where(
        and(
          gte(dailyActivity.day, startDate),
          lte(dailyActivity.day, endDate)
        )
      )
      .orderBy(dailyActivity.day),
    db
      .select({ day: dailyMood.day, moodScore: dailyMood.moodScore })
      .from(dailyMood)
      .where(and(gte(dailyMood.day, startDate), lte(dailyMood.day, endDate)))
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
      .orderBy(desc(episodeAssessments.day)),
    db.select().from(medications),
    db
      .select()
      .from(medicationLogs)
      .where(and(gte(medicationLogs.day, startDate), lte(medicationLogs.day, endDate))),
    loadActiveConfig(),
    loadBipolarType(),
  ]);
  const episodeRows = filterCurrentPatternAssessments(
    assessmentRows,
    patternConfig.version,
    bipolarType
  )
    .filter((assessment) => assessment.tier !== "none")
    .map(({ day, tier, direction }) => ({ day, tier, direction }));

  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new TypeError("Invalid report date range");
  }
  const totalDays = Math.floor((end - start) / 86_400_000) + 1;

  const sleepValues = sleepRows
    .map((row) => row.totalSleepSeconds)
    .filter(
      (value): value is number =>
        value != null && Number.isFinite(value) && value > 0
    );
  const hrvValues = sleepRows
    .map((row) => row.avgHrv)
    .filter(
      (value): value is number =>
        value != null && Number.isFinite(value) && value > 0
    );
  const stepValues = activityRows
    .map((row) => row.steps)
    .filter(
      (value): value is number =>
        value != null && Number.isFinite(value) && value >= 0
    );
  const moodValues = moodRows.map((r) => r.moodScore);

  const medAdherence = summarizeRecordedMedicationLogs(medRows, medLogRows);

  const measuredOuraDays = new Set(
    [
      ...sleepRows
        .filter(
          (row) =>
            row.totalSleepSeconds != null || row.avgHrv != null
        )
        .map((row) => row.day),
      ...activityRows
        .filter((row) => row.steps != null)
        .map((row) => row.day),
    ]
  ).size;

  return {
    dateRange: { start: startDate, end: endDate },
    summary: {
      totalDays,
      avgSleepHours: sleepValues.length > 0
        ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length / 3600
        : null,
      avgHrv: hrvValues.length > 0
        ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length
        : null,
      avgSteps: stepValues.length > 0
        ? Math.round(stepValues.reduce((a, b) => a + b, 0) / stepValues.length)
        : null,
      sleepDays: sleepValues.length,
      hrvDays: hrvValues.length,
      stepDays: stepValues.length,
      moodEntries: moodValues.length,
      avgMood: moodValues.length > 0
        ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length
        : null,
    },
    trends: {
      sleepTrend: computeTrend(sleepValues),
      hrvTrend: computeTrend(hrvValues),
    },
    episodes: episodeRows,
    medicationAdherence: medAdherence,
    dataCompleteness: {
      ouraDays: measuredOuraDays,
      moodDays: moodRows.length,
      totalDays,
      ouraRate: totalDays > 0 ? measuredOuraDays / totalDays : 0,
      moodRate: totalDays > 0 ? moodRows.length / totalDays : 0,
    },
  };
}
