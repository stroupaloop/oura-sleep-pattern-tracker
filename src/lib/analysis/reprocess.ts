import { db } from "@/lib/db";
import {
  sleepPeriods,
  dailyActivity,
  dailyStress,
  dailyResilience,
  dailySleep,
  dailyReadiness,
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

export interface ReprocessResult {
  daysProcessed: number;
  episodes: { watch: number; warning: number; alert: number };
  processingTimeMs: number;
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

  const activityByDay = new Map(allActivityRows.map((r) => [r.day, r]));
  const stressByDay = new Map(allStressRows.map((r) => [r.day, r]));
  const resilienceByDay = new Map(allResilienceRows.map((r) => [r.day, r]));
  const dailySleepByDay = new Map(allDailySleepRows.map((r) => [r.day, r]));
  const readinessByDay = new Map(allReadinessRows.map((r) => [r.day, r]));

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
        m.lowestHeartRate = row.lowestHeartRate ?? 0;
        m.averageBreath = row.averageBreath ?? 0;

        const activity = activityByDay.get(row.day);
        if (activity) {
          m.steps = activity.steps ?? 0;
          m.activeMinutes = Math.round(
            ((activity.highActivityTime ?? 0) + (activity.mediumActivityTime ?? 0)) / 60
          );
          if (activity.class5min) {
            m.activityClassFragmentation = computeIntradailyVariability(activity.class5min);
          }
        }

        const stress = stressByDay.get(row.day);
        if (stress) {
          m.stressHigh = stress.stressHigh ?? 0;
          m.recoveryHigh = stress.recoveryHigh ?? 0;
        }

        const resilience = resilienceByDay.get(row.day);
        if (resilience) {
          m.resilienceLevel = resilience.level;
        }

        const ds = dailySleepByDay.get(row.day);
        if (ds) {
          m.sleepTimingScore = ds.contributorTiming ?? 0;
        }

        const readiness = readinessByDay.get(row.day);
        if (readiness) {
          m.readinessScore = readiness.score ?? 0;
          m.temperatureDeviation = readiness.temperatureDeviation ?? 0;
          m.temperatureTrendDeviation = readiness.temperatureTrendDeviation ?? 0;
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

    const windowStart = Math.max(0, i - 6);
    const sleepWindow = sortedDays.slice(windowStart, i + 1).map((d) => allMetricsByDay.get(d)).filter((x): x is DayMetrics => !!x);
    if (sleepWindow.length >= 3) {
      m.dayToDaySleepCV = computeRollingCV(sleepWindow.map((x) => x.totalSleepMinutes), sleepWindow.length);
      m.dayToDayBedtimeCV = computeRollingCV(sleepWindow.map((x) => x.bedtimeMinutes), sleepWindow.length);
      m.dayToDayWakeCV = computeRollingCV(sleepWindow.map((x) => x.wakeTimeMinutes), sleepWindow.length);
    }

    const circStart = Math.max(0, i - 2);
    const circDays = sortedDays.slice(circStart, i + 1);
    const circClass5min = circDays.map((d) => class5minByDay.get(d)).filter((x): x is string => !!x);
    if (circClass5min.length >= 3) {
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

    const dayIndex = sortedDays.indexOf(day);
    const priorDays = sortedDays.slice(Math.max(0, dayIndex - config.baselineDays), dayIndex);
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

  const allCalendarDays: string[] = [];
  if (sortedDays.length > 0) {
    const first = new Date(sortedDays[0]);
    const last = new Date(sortedDays[sortedDays.length - 1]);
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      allCalendarDays.push(d.toISOString().slice(0, 10));
    }
  }

  for (const day of uniqueFilteredDays) {
    const dayIndex = sortedDays.indexOf(day);
    if (dayIndex < 0) continue;

    const calendarIndex = allCalendarDays.indexOf(day);
    const expectedDaysByWindow: Record<number, number> = {};
    for (const size of [3, 5, 7]) {
      if (calendarIndex >= 0) {
        const windowStartCal = Math.max(0, calendarIndex - size + 1);
        expectedDaysByWindow[size] = calendarIndex - windowStartCal + 1;
      } else {
        expectedDaysByWindow[size] = size;
      }
    }

    const windowStart = Math.max(0, dayIndex - 7);
    const recentDays = sortedDays.slice(windowStart, dayIndex + 1);
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
