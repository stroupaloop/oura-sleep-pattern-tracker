import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dailyAnalysis,
  dailyReadiness,
  dailySleep,
  episodeAssessments,
  oauthTokens,
  sleepPeriods,
} from "@/lib/db/schema";
import { getTodayET, shiftIsoDay } from "@/lib/date-utils";
import { loadActiveConfig, loadBipolarType } from "@/lib/analysis/config";
import {
  currentDailyPatternFields,
  filterCurrentPatternAssessments,
} from "@/lib/analysis/provenance";
import { computeDataAvailability } from "@/lib/analysis/confidence";
import { summarizeEpisodePattern } from "@/lib/episode-pattern";
import { averagePresent, summarizeStoredSamples } from "@/lib/dashboard-metrics";
import { missingOuraScopes } from "@/lib/oura/contracts";
import { loadOuraConnectionHealth } from "@/lib/oura/connection-health-data";
import {
  NIGHT_SLEEP_TYPES,
  selectNightGroupsByDay,
} from "@/lib/oura/main-sleep";
import { fillCalendarDays } from "./calendar-rows";
import { currentEtHour, MORNING_ENDS_ET_HOUR } from "./format";
import { buildNightWindow } from "./night-window";
import { buildSignals } from "./signals";

const TREND_DAYS = 30;
const COMPOSITION_DAYS = 14;
const PATTERN_DAYS = 14;

/** A day on the trend charts; `noNight` marks one with no night recorded. */
interface TrendRow {
  day: string;
  hours: number | null;
  deep: number | null;
  rem: number | null;
  light: number | null;
  efficiency: number | null;
  hrv: number | null;
  hr: number | null;
  noNight?: boolean;
}

interface CompositionRow {
  day: string;
  deep: number | null;
  rem: number | null;
  light: number | null;
  awake: number | null;
  deepMin: number | null;
  remMin: number | null;
  lightMin: number | null;
  awakeMin: number | null;
  noNight?: boolean;
}

export type HealthDashboardData = NonNullable<
  Awaited<ReturnType<typeof loadHealthDashboard>>
>;

/** Everything the Health page shows, or null before Oura is connected. */
export async function loadHealthDashboard() {
  const [token] = await db
    .select({ scope: oauthTokens.scope })
    .from(oauthTokens)
    .limit(1);
  if (!token) return null;

  const today = getTodayET();
  const trendStart = shiftIsoDay(today, -(TREND_DAYS - 1)) ?? today;
  const periodStart = shiftIsoDay(trendStart, -1) ?? trendStart;
  const patternStart = shiftIsoDay(today, -(PATTERN_DAYS - 1)) ?? today;

  const [
    periodRows,
    analysisRows,
    config,
    bipolarType,
    assessmentRows,
    availability,
    connection,
  ] = await Promise.all([
    db
      .select({
        id: sleepPeriods.id,
        day: sleepPeriods.day,
        type: sleepPeriods.type,
        bedtimeStart: sleepPeriods.bedtimeStart,
        bedtimeEnd: sleepPeriods.bedtimeEnd,
        totalSleepDuration: sleepPeriods.totalSleepDuration,
        deepSleepDuration: sleepPeriods.deepSleepDuration,
        lightSleepDuration: sleepPeriods.lightSleepDuration,
        remSleepDuration: sleepPeriods.remSleepDuration,
        awakeTime: sleepPeriods.awakeTime,
        timeInBed: sleepPeriods.timeInBed,
        latency: sleepPeriods.latency,
        efficiency: sleepPeriods.efficiency,
        averageHrv: sleepPeriods.averageHrv,
        averageHeartRate: sleepPeriods.averageHeartRate,
        hypnogram5min: sleepPeriods.hypnogram5min,
        hr5min: sleepPeriods.hr5min,
      })
      .from(sleepPeriods)
      .where(
        and(
          gte(sleepPeriods.day, periodStart),
          inArray(sleepPeriods.type, [...NIGHT_SLEEP_TYPES])
        )
      ),
    db
      .select()
      .from(dailyAnalysis)
      .where(gte(dailyAnalysis.day, trendStart))
      .orderBy(desc(dailyAnalysis.day)),
    loadActiveConfig(),
    loadBipolarType(),
    db
      .select({
        id: episodeAssessments.id,
        day: episodeAssessments.day,
        tier: episodeAssessments.tier,
        direction: episodeAssessments.direction,
        confidence: episodeAssessments.confidence,
        configVersion: episodeAssessments.configVersion,
        bipolarProfile: episodeAssessments.bipolarProfile,
        algorithmVersion: episodeAssessments.algorithmVersion,
        signalMode: episodeAssessments.signalMode,
      })
      .from(episodeAssessments)
      .where(gte(episodeAssessments.day, trendStart))
      .orderBy(desc(episodeAssessments.day)),
    computeDataAvailability(TREND_DAYS),
    loadOuraConnectionHealth().catch(() => null),
  ]);

  const groups = selectNightGroupsByDay(periodRows);
  const nightDays = [...groups.keys()]
    .filter((day) => day >= trendStart && day <= today)
    .sort();
  const shownDay = nightDays.at(-1) ?? null;
  const shown = shownDay ? groups.get(shownDay)! : null;
  // Until noon ET today's night may simply not have synced, and the notice at
  // the top says so, so the charts end at the last night that is due.
  const lastDueNight =
    nightDays.includes(today) || currentEtHour() >= MORNING_ENDS_ET_HOUR
      ? today
      : (shiftIsoDay(today, -1) ?? today);

  const currentAssessments = filterCurrentPatternAssessments(
    assessmentRows,
    config.version,
    bipolarType
  );
  const currentAssessmentDays = new Set(
    currentAssessments.map((assessment) => assessment.day)
  );
  const analysisByDay = new Map(analysisRows.map((row) => [row.day, row]));
  const shownAnalysis = shownDay ? analysisByDay.get(shownDay) ?? null : null;

  const [sleepScore, readiness] = shownDay
    ? await Promise.all([
        db
          .select()
          .from(dailySleep)
          .where(eq(dailySleep.day, shownDay))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select()
          .from(dailyReadiness)
          .where(eq(dailyReadiness.day, shownDay))
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ])
    : [null, null];

  const trendNights = nightDays.map((day) => groups.get(day)!.night);
  const chartData = trendNights
    .filter((night) => (night.totalSleepDuration ?? 0) > 0)
    .map((night) => {
      const hours = (seconds: number | null) =>
        seconds != null ? +(seconds / 3600).toFixed(2) : null;
      return {
        day: night.day,
        hours: +(night.totalSleepDuration! / 3600).toFixed(2),
        deep: hours(night.deepSleepDuration),
        rem: hours(night.remSleepDuration),
        light: hours(night.lightSleepDuration),
        efficiency: night.efficiency,
        hrv: night.averageHrv,
        hr: summarizeStoredSamples(night.hr5min).average ?? night.averageHeartRate,
      };
    });
  const trendRows = fillCalendarDays<TrendRow>(
    chartData,
    { start: trendStart, end: lastDueNight },
    (day) => ({
      day,
      hours: null,
      deep: null,
      rem: null,
      light: null,
      efficiency: null,
      hrv: null,
      hr: null,
      noNight: true,
    })
  );
  const analysisChartData = [...analysisRows].reverse().map((row) => ({
    day: row.day,
    baselineHrv: row.baselineHrv,
    baselineHeartRate: row.baselineHeartRate,
    ...currentDailyPatternFields(
      row.day,
      { isAnomaly: row.isAnomaly, anomalyDirection: row.anomalyDirection },
      currentAssessmentDays
    ),
    hrvZScore: row.hrvZScore,
    heartRateZScore: row.heartRateZScore,
  }));
  const compositionStart =
    shiftIsoDay(lastDueNight, -(COMPOSITION_DAYS - 1)) ?? lastDueNight;
  const compositionNights = trendNights
    .filter((night) => night.day >= compositionStart)
    .flatMap((night) => {
      const asleep = night.totalSleepDuration;
      const awake = night.awakeTime;
      if (asleep == null || awake == null || asleep + awake <= 0) return [];
      const inBed = asleep + awake;
      const percent = (seconds: number | null) =>
        seconds != null ? +((seconds / inBed) * 100).toFixed(1) : null;
      const minutes = (seconds: number | null) =>
        seconds != null ? seconds / 60 : null;
      return [
        {
          day: night.day,
          deep: percent(night.deepSleepDuration),
          rem: percent(night.remSleepDuration),
          light: percent(night.lightSleepDuration),
          awake: percent(awake),
          deepMin: minutes(night.deepSleepDuration),
          remMin: minutes(night.remSleepDuration),
          lightMin: minutes(night.lightSleepDuration),
          awakeMin: awake / 60,
        },
      ];
    });
  const compositionData = fillCalendarDays<CompositionRow>(
    compositionNights,
    { start: compositionStart, end: lastDueNight },
    (day) => ({
      day,
      deep: null,
      rem: null,
      light: null,
      awake: null,
      deepMin: null,
      remMin: null,
      lightMin: null,
      awakeMin: null,
      noNight: true,
    })
  );

  return {
    today,
    shownDay,
    isLastNight: shownDay === today,
    night: shown
      ? {
          totalSleepSeconds: shown.night.totalSleepDuration,
          timeInBedSeconds: shown.night.timeInBed ?? null,
          efficiency: shown.night.efficiency ?? null,
          periodCount: shown.periods.length,
          window: buildNightWindow(
            shown.periods,
            shownAnalysis
              ? {
                  bedtimeMinutes: shownAnalysis.baselineBedtimeMinutes,
                  wakeMinutes: shownAnalysis.baselineWakeMinutes,
                }
              : null
          ),
          main: {
            bedtimeStart: shown.main.bedtimeStart,
            bedtimeEnd: shown.main.bedtimeEnd,
            hypnogram5min: shown.main.hypnogram5min,
            hr5min: shown.main.hr5min,
          },
        }
      : null,
    signals: buildSignals(shownAnalysis, config.dailyAnomalyThreshold),
    threshold: config.dailyAnomalyThreshold,
    pattern: summarizeEpisodePattern(currentAssessments, patternStart),
    latestCheckedDay: currentAssessments[0]?.day ?? null,
    scores: { sleep: sleepScore, readiness },
    trends: {
      chartData: trendRows,
      analysisChartData,
      compositionData,
      averageSleepSeconds: averagePresent(
        trendNights.map((night) => night.totalSleepDuration)
      ),
      nightsCounted: chartData.length,
      windowDays: TREND_DAYS,
    },
    availability,
    missingScopes: missingOuraScopes(token.scope),
    connection,
  };
}
