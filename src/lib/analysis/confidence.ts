import { db } from "@/lib/db";
import {
  dailyActivity,
  dailyMood,
  medicationLogs,
  medications,
  sleepPeriods,
} from "@/lib/db/schema";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { format, subDays } from "date-fns";
import {
  APP_TIME_ZONE,
  getTodayET,
  shiftIsoDay,
} from "@/lib/date-utils";
import { projectActivityToCalendarDays } from "@/lib/oura/activity";
import { getOuraSleepDayForTimestamp } from "@/lib/oura/sleep-day";

export interface DayAvailability {
  measuredDays: number;
  latestDay: string | null;
}

export interface DataAvailability {
  windowDays: number;
  sleep: DayAvailability;
  activity: DayAvailability;
  mood: DayAvailability;
  medicationLogging: {
    activeMedications: number;
    entries: number;
    loggedDays: number;
    latestDay: string | null;
  };
}

function readCount(value: number | null | undefined): number {
  return value != null && Number.isFinite(value) ? Number(value) : 0;
}

function summarizeDays(
  days: Array<string | null>,
  startDate: string,
  endDate: string
): DayAvailability {
  const measuredDays = new Set(
    days.filter(
      (day): day is string =>
        day != null && day >= startDate && day <= endDate
    )
  );
  const orderedDays = [...measuredDays].sort();
  return {
    measuredDays: orderedDays.length,
    latestDay: orderedDays[orderedDays.length - 1] ?? null,
  };
}

export function summarizeEtSleepAvailability(
  records: Array<{ bedtimeEnd: string | null }>,
  startDate: string,
  endDate: string
): DayAvailability {
  return summarizeDays(
    records.map((record) =>
      record.bedtimeEnd
        ? getOuraSleepDayForTimestamp(record.bedtimeEnd)
        : null
    ),
    startDate,
    endDate
  );
}

export async function computeDataAvailability(
  windowDays = 30
): Promise<DataAvailability> {
  if (!Number.isInteger(windowDays) || windowDays <= 0) {
    throw new RangeError("Data availability window must be a positive integer");
  }

  const today = getTodayET();
  const startDate = format(
    subDays(new Date(`${today}T12:00:00`), windowDays - 1),
    "yyyy-MM-dd"
  );
  const sourceStartDate = shiftIsoDay(startDate, -1) ?? startDate;
  const sourceEndDate = shiftIsoDay(today, 1) ?? today;

  const [
    sleepRows,
    activityRows,
    moodResult,
    activeMedicationResult,
    medicationLogResult,
  ] = await Promise.all([
    db
      .select({
        bedtimeEnd: sleepPeriods.bedtimeEnd,
      })
      .from(sleepPeriods)
      .where(
        and(
          gte(sleepPeriods.day, sourceStartDate),
          lte(sleepPeriods.day, sourceEndDate),
          eq(sleepPeriods.type, "long_sleep"),
          isNotNull(sleepPeriods.totalSleepDuration),
          isNotNull(sleepPeriods.bedtimeEnd)
        )
      ),
    db
      .select({
        day: dailyActivity.day,
        class5min: dailyActivity.class5min,
        met: dailyActivity.met,
      })
      .from(dailyActivity)
      .where(
        and(
          gte(dailyActivity.day, sourceStartDate),
          lte(dailyActivity.day, sourceEndDate),
          isNotNull(dailyActivity.class5min),
          isNotNull(dailyActivity.met)
        )
      ),
    db
      .select({
        count: sql<number>`count(distinct ${dailyMood.day})`,
        latestDay: sql<string | null>`max(${dailyMood.day})`,
      })
      .from(dailyMood)
      .where(
        and(gte(dailyMood.day, startDate), lte(dailyMood.day, today))
      )
      .then((rows) => rows[0]),
    db
      .select({ count: sql<number>`count(*)` })
      .from(medications)
      .where(eq(medications.isActive, 1))
      .then((rows) => rows[0]),
    db
      .select({
        entries: sql<number>`count(*)`,
        loggedDays: sql<number>`count(distinct ${medicationLogs.day})`,
        latestDay: sql<string | null>`max(${medicationLogs.day})`,
      })
      .from(medicationLogs)
      .where(
        and(
          gte(medicationLogs.day, startDate),
          lte(medicationLogs.day, today)
        )
      )
      .then((rows) => rows[0]),
  ]);
  const sleepAvailability = summarizeEtSleepAvailability(
    sleepRows,
    startDate,
    today
  );
  const activityAvailability = summarizeDays(
    projectActivityToCalendarDays(
      activityRows,
      APP_TIME_ZONE
    ).map((day) => (day.classifiedMinutes > 0 ? day.day : null)),
    startDate,
    today
  );

  return {
    windowDays,
    sleep: sleepAvailability,
    activity: activityAvailability,
    mood: {
      measuredDays: readCount(moodResult?.count),
      latestDay: moodResult?.latestDay ?? null,
    },
    medicationLogging: {
      activeMedications: readCount(activeMedicationResult?.count),
      entries: readCount(medicationLogResult?.entries),
      loggedDays: readCount(medicationLogResult?.loggedDays),
      latestDay: medicationLogResult?.latestDay ?? null,
    },
  };
}
