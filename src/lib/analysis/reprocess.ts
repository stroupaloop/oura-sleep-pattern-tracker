import { db } from "@/lib/db";
import {
  sleepPeriods,
  dailyActivity,
  dailyStress,
  dailyResilience,
  dailySleep,
  dailyReadiness,
  dailyMood,
  dailySpo2,
  medicationLogs,
  dailyAnalysis,
  episodeAssessments,
} from "@/lib/db/schema";
import { and, gte, inArray, lte } from "drizzle-orm";
import { DetectionConfigValues, BipolarType } from "./config";
import { getTodayET } from "@/lib/date-utils";
import {
  NIGHT_SLEEP_TYPES,
  selectNightSleepByDay,
} from "@/lib/oura/main-sleep";
import { extractMetrics, upsertDailyAnalysis, DayMetrics } from "./anomaly";
import { upsertEpisodeAssessment } from "./episode";
import { scoreHistory } from "./score-history";
import {
  computeWithinNightCV,
  parseHypnogram5min,
  computeSleepStageTransitions,
  computeHypnogramFragmentation,
  computeIntradailyVariability,
  computeRelativeAmplitude,
  computeInterdailyStability,
  computeRollingCV,
} from "./variability";
import { circularVariation, isNextCalendarDay } from "./baseline";

export interface ReprocessResult {
  daysProcessed: number;
  episodes: { watch: number; warning: number; alert: number };
  /** Older pattern checks dropped for days the current algorithm does not score. */
  resultsRemoved: number;
  processingTimeMs: number;
}

const DELETE_BATCH_DAYS = 500;

/**
 * Leaves the range holding only what this run wrote. A day the current
 * algorithm no longer scores, such as the first nights back after weeks
 * without the ring, when there is no baseline yet, would otherwise keep a
 * result computed the old way: hidden as out of date, and never updated.
 */
async function removeResultsNotRecomputed(
  startDate: string | undefined,
  endDate: string | undefined,
  analysedDays: ReadonlySet<string>,
  assessedDays: ReadonlySet<string>
): Promise<number> {
  const [analysisRows, assessmentRows] = await Promise.all([
    db
      .select({ day: dailyAnalysis.day })
      .from(dailyAnalysis)
      .where(
        and(
          startDate ? gte(dailyAnalysis.day, startDate) : undefined,
          endDate ? lte(dailyAnalysis.day, endDate) : undefined
        )
      ),
    db
      .select({ day: episodeAssessments.day })
      .from(episodeAssessments)
      .where(
        and(
          startDate ? gte(episodeAssessments.day, startDate) : undefined,
          endDate ? lte(episodeAssessments.day, endDate) : undefined
        )
      ),
  ]);
  const staleAnalysis = analysisRows
    .map((row) => row.day)
    .filter((day) => !analysedDays.has(day));
  const staleAssessments = assessmentRows
    .map((row) => row.day)
    .filter((day) => !assessedDays.has(day));

  for (let i = 0; i < staleAnalysis.length; i += DELETE_BATCH_DAYS) {
    await db
      .delete(dailyAnalysis)
      .where(
        inArray(dailyAnalysis.day, staleAnalysis.slice(i, i + DELETE_BATCH_DAYS))
      );
  }
  for (let i = 0; i < staleAssessments.length; i += DELETE_BATCH_DAYS) {
    await db
      .delete(episodeAssessments)
      .where(
        inArray(
          episodeAssessments.day,
          staleAssessments.slice(i, i + DELETE_BATCH_DAYS)
        )
      );
  }
  return staleAssessments.length;
}

function trailingConsecutiveDays(
  sortedDays: string[],
  endIndex: number,
  maximumDays: number
): string[] {
  const days = [sortedDays[endIndex]];
  for (
    let index = endIndex - 1;
    index >= 0 && days.length < maximumDays;
    index--
  ) {
    if (!isNextCalendarDay(sortedDays[index], days[0])) break;
    days.unshift(sortedDays[index]);
  }
  return days;
}

export async function reprocessAll(
  config: DetectionConfigValues,
  startDate?: string,
  endDate?: string,
  bipolarType: BipolarType = "unspecified"
): Promise<ReprocessResult> {
  const start = performance.now();

  const sleepPeriodRows = await db
    .select()
    .from(sleepPeriods)
    .where(inArray(sleepPeriods.type, [...NIGHT_SLEEP_TYPES]))
    .orderBy(sleepPeriods.day);
  const allSleepRows = [...selectNightSleepByDay(sleepPeriodRows).values()]
    .sort((left, right) => left.day.localeCompare(right.day));

  const filtered = allSleepRows.filter((row) => {
    if (startDate && row.day < startDate) return false;
    if (endDate && row.day > endDate) return false;
    return true;
  });

  // Oura keeps today's activity up to date as the day goes, so a partial
  // count would read as an unusually inactive day. It joins tomorrow.
  const today = getTodayET();
  const allActivityRows = (
    await db.select().from(dailyActivity).orderBy(dailyActivity.day)
  ).filter((row) => row.day < today);
  const allStressRows = await db.select().from(dailyStress).orderBy(dailyStress.day);
  const allResilienceRows = await db.select().from(dailyResilience).orderBy(dailyResilience.day);
  const allDailySleepRows = await db.select().from(dailySleep).orderBy(dailySleep.day);
  const allReadinessRows = await db.select().from(dailyReadiness).orderBy(dailyReadiness.day);
  const allMoodRows = await db.select().from(dailyMood).orderBy(dailyMood.day);
  const allSpo2Rows = await db.select().from(dailySpo2).orderBy(dailySpo2.day);
  const allMedLogRows = await db.select().from(medicationLogs).orderBy(medicationLogs.day);

  const activityByDay = new Map(allActivityRows.map((r) => [r.day, r]));
  const stressByDay = new Map(allStressRows.map((r) => [r.day, r]));
  const resilienceByDay = new Map(allResilienceRows.map((r) => [r.day, r]));
  const dailySleepByDay = new Map(allDailySleepRows.map((r) => [r.day, r]));
  const readinessByDay = new Map(allReadinessRows.map((r) => [r.day, r]));
  const moodByDay = new Map(allMoodRows.map((r) => [r.day, r]));
  const spo2ByDay = new Map(allSpo2Rows.map((r) => [r.day, r]));
  const medLogsByDay = new Map<string, typeof allMedLogRows>();
  for (const log of allMedLogRows) {
    const existing = medLogsByDay.get(log.day) ?? [];
    existing.push(log);
    medLogsByDay.set(log.day, existing);
  }

  const allMetricsByDay = new Map<string, DayMetrics>();
  for (const row of allSleepRows) {
    if (!allMetricsByDay.has(row.day)) {
      const m = extractMetrics(row);
      if (m) {
        if (row.hrv5min) m.withinNightHrvCV = computeWithinNightCV(row.hrv5min);
        if (row.hr5min) m.withinNightHrCV = computeWithinNightCV(row.hr5min);
        if (row.hypnogram5min) {
          const stages = parseHypnogram5min(row.hypnogram5min);
          m.sleepStageTransitions = computeSleepStageTransitions(stages);
          m.hypnogramFragmentation = computeHypnogramFragmentation(stages);
        }
        m.lowestHeartRate = row.lowestHeartRate ?? Number.NaN;
        m.averageBreath = row.averageBreath ?? Number.NaN;

        const activity = activityByDay.get(row.day);
        if (activity) {
          m.steps = activity.steps ?? Number.NaN;
          m.activeMinutes =
            activity.highActivityTime == null &&
            activity.mediumActivityTime == null
              ? Number.NaN
              : Math.round(
                  ((activity.highActivityTime ?? 0) +
                    (activity.mediumActivityTime ?? 0)) /
                    60
                );
          if (activity.class5min) {
            m.activityClassFragmentation = computeIntradailyVariability(activity.class5min);
          }
        }

        const stress = stressByDay.get(row.day);
        if (stress) {
          m.stressHigh = stress.stressHigh ?? Number.NaN;
          m.recoveryHigh = stress.recoveryHigh ?? Number.NaN;
        }

        const resilience = resilienceByDay.get(row.day);
        if (resilience) {
          m.resilienceLevel = resilience.level;
        }

        const ds = dailySleepByDay.get(row.day);
        if (ds) {
          m.sleepTimingScore = ds.contributorTiming ?? Number.NaN;
        }

        const readiness = readinessByDay.get(row.day);
        if (readiness) {
          m.readinessScore = readiness.score ?? Number.NaN;
          m.temperatureDeviation =
            readiness.temperatureDeviation ?? Number.NaN;
          m.temperatureDelta = m.temperatureDeviation;
          m.temperatureTrendDeviation =
            readiness.temperatureTrendDeviation ?? Number.NaN;
        }

        const mood = moodByDay.get(row.day);
        if (mood) {
          m.moodScore = mood.moodScore;
          m.energyScore = mood.energyScore ?? null;
          m.irritabilityScore = mood.irritabilityScore ?? null;
          m.anxietyScore = mood.anxietyScore ?? null;
          m.episodeState = mood.episodeState ?? null;
        }

        const spo2 = spo2ByDay.get(row.day);
        if (spo2) {
          m.averageSpo2 = spo2.averageSpo2 ?? null;
          m.breathingDisturbanceIndex = spo2.breathingDisturbanceIndex ?? null;
        }

        allMetricsByDay.set(row.day, m);
      }
    }
  }

  const sortedDays = [...allMetricsByDay.keys()].sort();
  const filteredDays = filtered.map((r) => r.day);
  const uniqueFilteredDays = [...new Set(filteredDays)].sort();

  const class5minByDay = new Map<string, string>();
  for (const row of allActivityRows) {
    if (row.class5min) class5minByDay.set(row.day, row.class5min);
  }

  for (let i = 0; i < sortedDays.length; i++) {
    const day = sortedDays[i];
    const m = allMetricsByDay.get(day);
    if (!m) continue;

    const consecutiveDays = trailingConsecutiveDays(sortedDays, i, 7);
    const sleepWindow = consecutiveDays
      .map((d) => allMetricsByDay.get(d))
      .filter((x): x is DayMetrics => !!x);
    if (sleepWindow.length >= 3) {
      m.dayToDaySleepCV = computeRollingCV(sleepWindow.map((x) => x.totalSleepMinutes), sleepWindow.length);
      m.dayToDayBedtimeCV = circularVariation(
        sleepWindow.map((x) => x.bedtimeMinutes)
      );
      m.dayToDayWakeCV = circularVariation(
        sleepWindow.map((x) => x.wakeTimeMinutes)
      );
    }

    const circDays = trailingConsecutiveDays(sortedDays, i, 3);
    const circClass5min = circDays.map((d) => class5minByDay.get(d)).filter((x): x is string => !!x);
    if (circDays.length === 3 && circClass5min.length === 3) {
      m.circadianIS = computeInterdailyStability(circClass5min);
    }
    const todayClass = class5minByDay.get(day);
    if (todayClass) {
      m.circadianIV = computeIntradailyVariability(todayClass);
      m.circadianRA = computeRelativeAmplitude(todayClass);
    }
  }

  const { daily, assessments } = scoreHistory(
    allMetricsByDay,
    config,
    bipolarType,
    uniqueFilteredDays
  );

  const analysedDays = new Set<string>();
  const assessedDays = new Set<string>();
  let daysProcessed = 0;
  const episodeCounts = { watch: 0, warning: 0, alert: 0 };

  for (const day of uniqueFilteredDays) {
    const result = daily.get(day);
    if (result) {
      await upsertDailyAnalysis(result);
      analysedDays.add(day);
      daysProcessed++;
    }
  }

  for (const day of uniqueFilteredDays) {
    const episode = assessments.get(day);
    if (!episode) continue;
    await upsertEpisodeAssessment(episode);
    assessedDays.add(day);

    if (episode.tier === "watch") episodeCounts.watch++;
    else if (episode.tier === "warning") episodeCounts.warning++;
    else if (episode.tier === "alert") episodeCounts.alert++;
  }

  // A night synced while this ran is the next run's to score, so nothing
  // after the last night read here is removed, and nothing at all if none was.
  const lastNight = allSleepRows[allSleepRows.length - 1]?.day;
  const resultsRemoved = lastNight
    ? await removeResultsNotRecomputed(
        startDate,
        endDate && endDate < lastNight ? endDate : lastNight,
        analysedDays,
        assessedDays
      )
    : 0;

  return {
    daysProcessed,
    episodes: episodeCounts,
    resultsRemoved,
    processingTimeMs: Math.round(performance.now() - start),
  };
}
