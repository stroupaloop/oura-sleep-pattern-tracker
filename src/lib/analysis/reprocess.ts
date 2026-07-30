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
} from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { DetectionConfigValues, BipolarType } from "./config";
import {
  extractMetrics,
  computeDailyAnalysis,
  upsertDailyAnalysis,
  DayMetrics,
  DailyAnalysisResult,
} from "./anomaly";
import { assessEpisode, upsertEpisodeAssessment } from "./episode";
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
  processingTimeMs: number;
}

function shiftCalendarDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
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

  const allSleepRows = await db
    .select()
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(sleepPeriods.day);

  const filtered = allSleepRows.filter((row) => {
    if (startDate && row.day < startDate) return false;
    if (endDate && row.day > endDate) return false;
    return true;
  });

  const allActivityRows = await db.select().from(dailyActivity).orderBy(dailyActivity.day);
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

  const dailyResults = new Map<string, DailyAnalysisResult>();
  let daysProcessed = 0;
  const episodeCounts = { watch: 0, warning: 0, alert: 0 };

  for (const day of sortedDays) {
    const metrics = allMetricsByDay.get(day);
    if (!metrics) continue;

    const baselineStart = shiftCalendarDay(day, -config.baselineDays);
    const priorDays = sortedDays.filter(
      (priorDay) => priorDay >= baselineStart && priorDay < day
    );
    const priorMetrics = priorDays
      .map((d) => allMetricsByDay.get(d))
      .filter((m): m is DayMetrics => m !== undefined);

    const result = computeDailyAnalysis(metrics, priorMetrics, config, bipolarType);
    if (result) {
      dailyResults.set(day, result);

      if (uniqueFilteredDays.includes(day)) {
        await upsertDailyAnalysis(result);
        daysProcessed++;
      }
    }
  }

  for (const day of uniqueFilteredDays) {
    const dayIndex = sortedDays.indexOf(day);
    if (dayIndex < 0) continue;

    const expectedDaysByWindow: Record<number, number> = {};
    for (const size of [3, 5, 7]) {
      expectedDaysByWindow[size] = size;
    }

    const recentStart = shiftCalendarDay(day, -6);
    const recentDays = sortedDays.filter(
      (recentDay) => recentDay >= recentStart && recentDay <= day
    );
    const recentResults = recentDays
      .map((d) => dailyResults.get(d))
      .filter((r): r is DailyAnalysisResult => r !== undefined);

    const allPriorDays = sortedDays.slice(0, dayIndex);
    const allPriorResults = allPriorDays
      .map((d) => dailyResults.get(d))
      .filter((r): r is DailyAnalysisResult => r !== undefined);

    if (recentResults.length > 0) {
      const episode = assessEpisode(day, recentResults, allPriorResults, config, expectedDaysByWindow, bipolarType);
      await upsertEpisodeAssessment(episode);

      if (episode.tier === "watch") episodeCounts.watch++;
      else if (episode.tier === "warning") episodeCounts.warning++;
      else if (episode.tier === "alert") episodeCounts.alert++;
    }
  }

  return {
    daysProcessed,
    episodes: episodeCounts,
    processingTimeMs: Math.round(performance.now() - start),
  };
}
