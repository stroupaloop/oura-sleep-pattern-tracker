import { db } from "@/lib/db";
import {
  dailyActivity,
  dailyMood,
  episodeAssessments,
  medicationLogs,
  medications,
  sleepPeriods,
} from "@/lib/db/schema";
import { gte, lte, lt, and, desc, inArray } from "drizzle-orm";
import {
  loadActiveConfig,
  loadBipolarType,
} from "@/lib/analysis/config";
import { filterCurrentPatternAssessments } from "@/lib/analysis/provenance";
import { summarizeRecordedMedicationLogs } from "./medication-adherence";
import { getTodayET } from "@/lib/date-utils";
import {
  NIGHT_SLEEP_TYPES,
  selectNightSleepByDay,
} from "@/lib/oura/main-sleep";

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
    moodMin: number | null;
    moodMax: number | null;
    moodHighDays: number;
    moodLowDays: number;
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

const TREND_MIN_VALUES = 7;
const TREND_Z_CUTOFF = 1.96;
const TREND_MIN_EFFECT = 0.05;
const HIGH_MOOD_FROM = 2;
const LOW_MOOD_UP_TO = -2;

function sortedMedian(sorted: ArrayLike<number>): number {
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mannKendallScore(series: number[]): number {
  let score = 0;
  for (let i = 0; i < series.length - 1; i++) {
    for (let j = i + 1; j < series.length; j++) {
      score += Math.sign(series[j] - series[i]);
    }
  }
  return score;
}

function mannKendallVariance(series: number[]): number {
  const n = series.length;
  const tieGroups = new Map<number, number>();
  for (const value of series) {
    tieGroups.set(value, (tieGroups.get(value) ?? 0) + 1);
  }
  let tieTerm = 0;
  for (const size of tieGroups.values()) {
    tieTerm += size * (size - 1) * (2 * size + 5);
  }
  return (n * (n - 1) * (2 * n + 5) - tieTerm) / 18;
}

function theilSenSlope(series: number[]): number {
  const slopes = new Float64Array((series.length * (series.length - 1)) / 2);
  let next = 0;
  for (let i = 0; i < series.length - 1; i++) {
    for (let j = i + 1; j < series.length; j++) {
      slopes[next++] = (series[j] - series[i]) / (j - i);
    }
  }
  slopes.sort();
  return sortedMedian(slopes);
}

/**
 * Which way a window of nightly values drifted. A rise or fall is called only
 * when the Mann-Kendall test is clear (tie-corrected, |z| >= 1.96, p < 0.05)
 * and the Theil-Sen slope carries the series at least 5% of its median from
 * first value to last. Otherwise the answer is "stable": no clear change, not
 * proof that nothing changed.
 */
export function computeTrend(values: number[]): ReportTrend {
  const series = values.filter(Number.isFinite);
  if (series.length < TREND_MIN_VALUES) return "insufficient_data";

  const score = mannKendallScore(series);
  const variance = mannKendallVariance(series);
  if (score === 0 || variance <= 0) return "stable";
  const z = (score - Math.sign(score)) / Math.sqrt(variance);
  if (Math.abs(z) < TREND_Z_CUTOFF) return "stable";

  const slope = theilSenSlope(series);
  const level = Math.abs(sortedMedian([...series].sort((a, b) => a - b)));
  if (level === 0 || Math.sign(slope) !== Math.sign(score)) return "stable";
  if ((Math.abs(slope) * (series.length - 1)) / level < TREND_MIN_EFFECT) {
    return "stable";
  }
  return score > 0 ? "increasing" : "decreasing";
}

export function summarizeMood(values: number[]) {
  if (values.length === 0) {
    return {
      entries: 0,
      average: null,
      lowest: null,
      highest: null,
      highDays: 0,
      lowDays: 0,
    };
  }
  return {
    entries: values.length,
    average: values.reduce((a, b) => a + b, 0) / values.length,
    lowest: Math.min(...values),
    highest: Math.max(...values),
    highDays: values.filter((value) => value >= HIGH_MOOD_FROM).length,
    lowDays: values.filter((value) => value <= LOW_MOOD_UP_TO).length,
  };
}

export async function generateReport(
  startDate: string,
  endDate: string
): Promise<ReportData> {
  const [
    sleepPeriodRows,
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
        type: sleepPeriods.type,
        bedtimeStart: sleepPeriods.bedtimeStart,
        bedtimeEnd: sleepPeriods.bedtimeEnd,
        totalSleepDuration: sleepPeriods.totalSleepDuration,
        timeInBed: sleepPeriods.timeInBed,
        averageHrv: sleepPeriods.averageHrv,
      })
      .from(sleepPeriods)
      .where(
        and(
          inArray(sleepPeriods.type, [...NIGHT_SLEEP_TYPES]),
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
          lte(dailyActivity.day, endDate),
          // Today's count is still climbing.
          lt(dailyActivity.day, getTodayET())
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

  const sleepRows = [...selectNightSleepByDay(sleepPeriodRows).values()].map(
    (night) => ({
      day: night.day,
      totalSleepSeconds: night.totalSleepDuration,
      avgHrv: night.averageHrv,
    })
  );
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
        // A zero-step day is a day the ring was off, not a still one.
        value != null && Number.isFinite(value) && value > 0
    );
  const mood = summarizeMood(moodRows.map((r) => r.moodScore));

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
      moodEntries: mood.entries,
      avgMood: mood.average,
      moodMin: mood.lowest,
      moodMax: mood.highest,
      moodHighDays: mood.highDays,
      moodLowDays: mood.lowDays,
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
