import type { sleepPeriods } from "@/lib/db/schema";
import { summarizeStoredSamples } from "@/lib/dashboard-metrics";
import { selectNightGroupsByDay } from "@/lib/oura/main-sleep";
import type { NightData } from "./night-card";

export type SleepPeriodRow = typeof sleepPeriods.$inferSelect;

/**
 * Days of sleep periods the page loads. The calendar's first cell is a
 * Monday at most 34 days back; the rest is margin.
 */
export const SLEEP_PAGE_LOOKBACK_DAYS = 40;

/**
 * The night behind each calendar day, by the app's own definition of a night:
 * the day's overnight periods, joined when sleep was broken, including the
 * short ones Oura types `sleep`. Total sleep, stages, efficiency and latency
 * describe the whole night, as the pattern checks stored it, so the
 * comparison with her usual beside each number is of the same night. Heart
 * rate, HRV, restlessness and the hypnogram are the longest period's own, and
 * the hypnogram starts at that period's bedtime.
 */
export function buildSleepPageNights(
  periods: readonly SleepPeriodRow[],
  temperatureByDay: ReadonlyMap<string, number | null>
): Record<string, NightData> {
  const nights: Record<string, NightData> = {};
  for (const [day, { night, main }] of selectNightGroupsByDay(periods)) {
    const heartRate = summarizeStoredSamples(main.hr5min);
    nights[day] = {
      id: main.id,
      day,
      bedtimeStart: main.bedtimeStart,
      bedtimeEnd: main.bedtimeEnd,
      totalSleepDuration: night.totalSleepDuration,
      deepSleepDuration: night.deepSleepDuration,
      lightSleepDuration: night.lightSleepDuration,
      remSleepDuration: night.remSleepDuration,
      efficiency: night.efficiency,
      latency: night.latency,
      restlessPeriods: main.restlessPeriods,
      averageHeartRate: heartRate.average ?? main.averageHeartRate,
      lowestHeartRate: heartRate.minimum ?? main.lowestHeartRate,
      averageHrv: main.averageHrv,
      temperatureDelta: temperatureByDay.get(day) ?? null,
      hypnogram5min: main.hypnogram5min,
      hr5min: main.hr5min,
    };
  }
  return nights;
}
