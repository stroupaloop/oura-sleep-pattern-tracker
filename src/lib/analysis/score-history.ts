import { BipolarType, DetectionConfigValues } from "./config";
import { computeDailyAnalysis, DailyAnalysisResult, DayMetrics } from "./anomaly";
import { assessEpisode, EpisodeResult } from "./episode";
import { LOWER_VIEW_DAYS } from "./persistence";

export interface ScoredHistory {
  daily: Map<string, DailyAnalysisResult>;
  assessments: Map<string, EpisodeResult>;
}

function shiftCalendarDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Scores every night against the nights before it and assesses the pattern
 * for the days asked for (all by default), using only what was known by then.
 * No database: reprocessAll reads the metrics, calls this and stores the
 * results, so tests and backtests run the same code path.
 */
export function scoreHistory(
  metricsByDay: ReadonlyMap<string, DayMetrics>,
  config: DetectionConfigValues,
  bipolarType: BipolarType,
  assessDays?: Iterable<string>
): ScoredHistory {
  const sortedDays = [...metricsByDay.keys()].sort();

  const daily = new Map<string, DailyAnalysisResult>();
  for (const day of sortedDays) {
    const metrics = metricsByDay.get(day);
    if (!metrics) continue;

    const baselineStart = shiftCalendarDay(
      day,
      -(config.baselineDays + config.baselineGuardDays)
    );
    const baselineEnd = shiftCalendarDay(day, -config.baselineGuardDays);
    const priorMetrics = sortedDays
      .filter((priorDay) => priorDay >= baselineStart && priorDay < baselineEnd)
      .map((priorDay) => metricsByDay.get(priorDay))
      .filter((m): m is DayMetrics => m !== undefined);

    const result = computeDailyAnalysis(metrics, priorMetrics, config, bipolarType);
    if (result) daily.set(day, result);
  }

  const wanted = assessDays ? new Set(assessDays) : null;
  const expectedDaysByWindow: Record<number, number> = {
    3: 3,
    5: 5,
    7: 7,
    [LOWER_VIEW_DAYS]: LOWER_VIEW_DAYS,
  };
  const assessments = new Map<string, EpisodeResult>();
  for (const [dayIndex, day] of sortedDays.entries()) {
    if (wanted && !wanted.has(day)) continue;

    const recentStart = shiftCalendarDay(day, -(LOWER_VIEW_DAYS - 1));
    const recentResults = sortedDays
      .filter((recentDay) => recentDay >= recentStart && recentDay <= day)
      .map((recentDay) => daily.get(recentDay))
      .filter((r): r is DailyAnalysisResult => r !== undefined);
    if (recentResults.length === 0) continue;

    const allPriorResults = sortedDays
      .slice(0, dayIndex)
      .map((priorDay) => daily.get(priorDay))
      .filter((r): r is DailyAnalysisResult => r !== undefined);

    assessments.set(
      day,
      assessEpisode(
        day,
        recentResults,
        allPriorResults,
        config,
        expectedDaysByWindow,
        bipolarType
      )
    );
  }

  return { daily, assessments };
}
