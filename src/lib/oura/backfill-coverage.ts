import { and, gte, inArray, lte, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db";
import {
  dailyActivity,
  dailyAnalysis,
  dailyCardiovascularAge,
  dailyHeartrate,
  dailyReadiness,
  dailyResilience,
  dailySleep,
  dailySpo2,
  dailyStress,
  sleepPeriods,
  sleepTime,
  vo2Max,
} from "@/lib/db/schema";
import { isOuraDatasetGranted, type OuraDataset } from "./contracts";
import { NIGHT_SLEEP_TYPES, selectNightSleepByDay } from "./main-sleep";

export interface CoverageRow {
  dataset: OuraDataset;
  label: string;
  days: number;
  latestDay: string | null;
  /** Oura was not asked for, or did not grant, this dataset's scope. */
  notShared: boolean;
}

export interface BackfillCoverage {
  windowDays: number;
  rows: CoverageRow[];
  /** Nights in the window, and how many of them have a pattern check. */
  nights: number;
  checkedNights: number;
}

const CORE_DATASETS: Array<{ dataset: OuraDataset; label: string }> = [
  { dataset: "sleep", label: "Sleep (nights)" },
  { dataset: "daily_sleep", label: "Sleep score" },
  { dataset: "daily_readiness", label: "Readiness" },
  { dataset: "daily_activity", label: "Activity" },
  { dataset: "daily_stress", label: "Stress" },
  { dataset: "daily_resilience", label: "Resilience" },
  { dataset: "daily_spo2", label: "Blood oxygen" },
  { dataset: "heartrate", label: "Heart rate" },
];

const PRIVATE_DATASETS: Array<{ dataset: OuraDataset; label: string }> = [
  { dataset: "daily_cardiovascular_age", label: "Cardiovascular age" },
  { dataset: "vO2_max", label: "VO₂ max" },
  { dataset: "sleep_time", label: "Bedtime guidance" },
];

export function windowDayCount(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Labels each dataset's measured days and marks the ones Oura is not sharing. */
export function buildCoverageRows(
  measured: Partial<Record<OuraDataset, { days: number; latestDay: string | null }>>,
  granted: Set<string> | null,
  includePrivate: boolean
): CoverageRow[] {
  const datasets = includePrivate
    ? [...CORE_DATASETS, ...PRIVATE_DATASETS]
    : CORE_DATASETS;
  return datasets.map(({ dataset, label }) => ({
    dataset,
    label,
    days: measured[dataset]?.days ?? 0,
    latestDay: measured[dataset]?.latestDay ?? null,
    notShared: !isOuraDatasetGranted(granted, dataset),
  }));
}

async function dayCoverage(
  table: SQLiteTable,
  day: SQLiteColumn,
  startDate: string,
  endDate: string
): Promise<{ days: number; latestDay: string | null }> {
  const [row] = await db
    .select({
      days: sql<number>`count(distinct ${day})`,
      latestDay: sql<string | null>`max(${day})`,
    })
    .from(table)
    .where(and(gte(day, startDate), lte(day, endDate)));
  return { days: Number(row?.days ?? 0), latestDay: row?.latestDay ?? null };
}

/** What a sync left in the database for each dataset across its window. */
export async function measureBackfillCoverage(
  startDate: string,
  endDate: string,
  granted: Set<string> | null,
  includePrivate: boolean
): Promise<BackfillCoverage> {
  const range = (table: SQLiteTable, day: SQLiteColumn) =>
    dayCoverage(table, day, startDate, endDate);

  const [periodRows, analysisDays, ...counts] = await Promise.all([
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
          gte(sleepPeriods.day, startDate),
          lte(sleepPeriods.day, endDate),
          inArray(sleepPeriods.type, [...NIGHT_SLEEP_TYPES])
        )
      ),
    db
      .select({ day: dailyAnalysis.day })
      .from(dailyAnalysis)
      .where(
        and(gte(dailyAnalysis.day, startDate), lte(dailyAnalysis.day, endDate))
      ),
    range(dailySleep, dailySleep.day),
    range(dailyReadiness, dailyReadiness.day),
    range(dailyActivity, dailyActivity.day),
    range(dailyStress, dailyStress.day),
    range(dailyResilience, dailyResilience.day),
    range(dailySpo2, dailySpo2.day),
    range(dailyHeartrate, dailyHeartrate.day),
    ...(includePrivate
      ? [
          range(dailyCardiovascularAge, dailyCardiovascularAge.day),
          range(vo2Max, vo2Max.day),
          range(sleepTime, sleepTime.day),
        ]
      : []),
  ]);

  const nightDays = [...selectNightSleepByDay(periodRows).keys()];
  const checked = new Set(analysisDays.map((row) => row.day));
  const [
    dailySleepCount,
    readinessCount,
    activityCount,
    stressCount,
    resilienceCount,
    spo2Count,
    heartRateCount,
    cvAgeCount,
    vo2Count,
    sleepTimeCount,
  ] = counts;

  return {
    windowDays: windowDayCount(startDate, endDate),
    rows: buildCoverageRows(
      {
        sleep: {
          days: nightDays.length,
          latestDay: [...nightDays].sort().at(-1) ?? null,
        },
        daily_sleep: dailySleepCount,
        daily_readiness: readinessCount,
        daily_activity: activityCount,
        daily_stress: stressCount,
        daily_resilience: resilienceCount,
        daily_spo2: spo2Count,
        heartrate: heartRateCount,
        ...(includePrivate
          ? {
              daily_cardiovascular_age: cvAgeCount,
              vO2_max: vo2Count,
              sleep_time: sleepTimeCount,
            }
          : {}),
      },
      granted,
      includePrivate
    ),
    nights: nightDays.length,
    checkedNights: nightDays.filter((day) => checked.has(day)).length,
  };
}
