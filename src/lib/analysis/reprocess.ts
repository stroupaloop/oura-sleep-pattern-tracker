import { db } from "@/lib/db";
import { sleepPeriods } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { DetectionConfigValues } from "./config";
import {
  extractMetrics,
  computeDailyAnalysis,
  upsertDailyAnalysis,
  DayMetrics,
  DailyAnalysisResult,
} from "./anomaly";
import { assessEpisode, upsertEpisodeAssessment } from "./episode";

export interface ReprocessResult {
  daysProcessed: number;
  episodes: { watch: number; warning: number; alert: number };
  processingTimeMs: number;
}

export async function reprocessAll(
  config: DetectionConfigValues,
  startDate?: string,
  endDate?: string
): Promise<ReprocessResult> {
  const start = performance.now();

  let query = db
    .select()
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(sleepPeriods.day);

  const allSleepRows = await query;

  const filtered = allSleepRows.filter((row) => {
    if (startDate && row.day < startDate) return false;
    if (endDate && row.day > endDate) return false;
    return true;
  });

  const allMetricsByDay = new Map<string, DayMetrics>();
  for (const row of allSleepRows) {
    if (!allMetricsByDay.has(row.day)) {
      const m = extractMetrics(row);
      if (m) allMetricsByDay.set(row.day, m);
    }
  }

  const sortedDays = [...allMetricsByDay.keys()].sort();
  const filteredDays = filtered.map((r) => r.day);
  const uniqueFilteredDays = [...new Set(filteredDays)].sort();

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

    const result = computeDailyAnalysis(metrics, priorMetrics, config);
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
      const episode = assessEpisode(day, recentResults, allPriorResults, config);
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
