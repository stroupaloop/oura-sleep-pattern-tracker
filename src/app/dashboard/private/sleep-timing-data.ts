import { getIsoTimeZoneClockMinutes } from "@/lib/date-utils";
import {
  selectNightSleepByDay,
  type NightSleepPeriod,
} from "@/lib/oura/main-sleep";
import { getOuraSleepDayForTimestamp } from "@/lib/oura/sleep-day";
import { getSleepTimeClockMinutes } from "@/lib/oura/sleep-time";

interface BedtimeGuidance {
  day: string;
  optimalBedtimeStart: string | null;
  optimalBedtimeEnd: string | null;
}

function normalizeOffsetMinutes(
  storedOffset: string | null | undefined,
  day: string
): number | null {
  let mins = getSleepTimeClockMinutes(day, storedOffset);
  if (mins == null) return null;
  if (mins < 720) mins += 1440;
  return mins;
}

/**
 * One row per night for the Sleep Timing chart, oldest first. A night is the
 * app's own (`main-sleep.ts`), so the short ones Oura types `sleep` are here,
 * an afternoon sleep never stands in for the night, and a broken night has
 * one bedtime, its first. Each row is named for the morning the night ends,
 * and carries Oura's suggested window for that night when there is one.
 */
export function buildBedtimeData(
  periods: readonly NightSleepPeriod[],
  guidance: readonly BedtimeGuidance[]
) {
  const nights = [...selectNightSleepByDay(periods).values()].sort(
    (left, right) => left.day.localeCompare(right.day)
  );

  return nights.flatMap((night) => {
    const sleepDayET = getOuraSleepDayForTimestamp(night.bedtimeEnd);
    if (sleepDayET == null) return [];

    const suggested = guidance.find((s) => s.day === night.day);
    let actualMinutes: number | null = null;
    if (night.bedtimeStart) {
      const etClockMinutes = getIsoTimeZoneClockMinutes(night.bedtimeStart);
      if (etClockMinutes != null) {
        actualMinutes =
          etClockMinutes < 720 ? etClockMinutes + 1440 : etClockMinutes;
      }
    }
    return [
      {
        day: sleepDayET,
        actualBedtime: actualMinutes,
        optimalStart: normalizeOffsetMinutes(
          suggested?.optimalBedtimeStart,
          night.day
        ),
        optimalEnd: normalizeOffsetMinutes(
          suggested?.optimalBedtimeEnd,
          night.day
        ),
      },
    ];
  });
}

/**
 * The morning the newest night ended. A nap or a brief doze is not a night,
 * so it never reads as last night having arrived.
 */
export function latestNightSourceDay(
  periods: readonly NightSleepPeriod[]
): string | null {
  let latest: string | null = null;
  for (const night of selectNightSleepByDay(periods).values()) {
    const day = getOuraSleepDayForTimestamp(night.bedtimeEnd);
    if (day != null && (latest == null || day > latest)) latest = day;
  }
  return latest;
}
