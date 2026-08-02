export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  oauthTokens,
  sleepPeriods,
  dailySleep,
  dailyReadiness,
  dailyAnalysis,
  dailyMood,
  medications,
  medicationLogs,
  episodeAssessments,
} from "@/lib/db/schema";
import { desc, sql, gte, eq } from "drizzle-orm";
import { format, subDays } from "date-fns";
import {
  formatIsoDay,
  formatIsoTimeInAppTimeZone,
  getTodayET,
  shiftIsoDay,
} from "@/lib/date-utils";
import {
  averagePresent,
  formatDuration,
  formatDurationDelta,
  summarizeStoredSamples,
} from "@/lib/dashboard-metrics";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SleepTrendChart } from "@/components/charts/sleep-trend-chart";
import { ScoreRing } from "@/components/charts/score-ring";
import { HypnogramChart } from "@/components/charts/hypnogram-chart";
import { SleepCompositionBar } from "@/components/charts/sleep-composition-bar";
import { ScoreBreakdown } from "@/components/charts/score-breakdown";
import { ResearchTooltip } from "@/components/research-tooltip";
import { DailyLogCard } from "@/components/daily-log-card";
import { DataAvailabilityCard } from "@/components/confidence-indicator";
import { computeDataAvailability } from "@/lib/analysis/confidence";
import {
  loadActiveConfig,
  loadBipolarType,
} from "@/lib/analysis/config";
import {
  currentDailyPatternFields,
  filterCurrentPatternAssessments,
} from "@/lib/analysis/provenance";
import { selectSleepForSleepDay } from "@/lib/oura/sleep-day";

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  return formatIsoTimeInAppTimeZone(iso) ?? "--";
}

export default async function DashboardPage() {
  const tokens = await db.select().from(oauthTokens).limit(1);
  const isConnected = tokens.length > 0;

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center space-y-6">
        <h1 className="text-3xl font-bold">Welcome</h1>
        <p className="text-muted-foreground">
          Connect your Oura Ring account to start tracking sleep patterns.
        </p>
        <Button asChild>
          <Link href="/dashboard/settings">Connect Oura Ring</Link>
        </Button>
      </div>
    );
  }

  const today = getTodayET();
  const previousNightDay = shiftIsoDay(today, -1) ?? today;
  const previousNightLabel =
    formatIsoDay(previousNightDay) ?? previousNightDay;
  const recentSleep = await db
    .select({
      day: sleepPeriods.day,
      totalSleepDuration: sleepPeriods.totalSleepDuration,
      deepSleepDuration: sleepPeriods.deepSleepDuration,
      remSleepDuration: sleepPeriods.remSleepDuration,
      lightSleepDuration: sleepPeriods.lightSleepDuration,
      awakeTime: sleepPeriods.awakeTime,
      efficiency: sleepPeriods.efficiency,
      averageHrv: sleepPeriods.averageHrv,
      averageHeartRate: sleepPeriods.averageHeartRate,
      bedtimeStart: sleepPeriods.bedtimeStart,
      bedtimeEnd: sleepPeriods.bedtimeEnd,
      hypnogram5min: sleepPeriods.hypnogram5min,
      hr5min: sleepPeriods.hr5min,
    })
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(desc(sleepPeriods.day))
    .limit(30);

  const sleep = selectSleepForSleepDay(recentSleep, today);
  const currentSleepSourceDay = sleep?.day;
  const [lastDailySleep, lastReadiness] = currentSleepSourceDay
    ? await Promise.all([
        db
          .select()
          .from(dailySleep)
          .where(eq(dailySleep.day, currentSleepSourceDay))
          .limit(1),
        db
          .select()
          .from(dailyReadiness)
          .where(eq(dailyReadiness.day, currentSleepSourceDay))
          .limit(1),
      ])
    : [[], []];

  const todayDate = new Date(today + "T12:00:00");
  const fourteenDaysAgo = format(subDays(todayDate, 13), "yyyy-MM-dd");
  const thirtyDaysAgo = format(subDays(todayDate, 29), "yyyy-MM-dd");
  const [patternConfig, bipolarType, recentAssessmentRows] = await Promise.all([
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
      .where(gte(episodeAssessments.day, thirtyDaysAgo))
      .orderBy(desc(episodeAssessments.day)),
  ]);
  const currentAssessments = filterCurrentPatternAssessments(
    recentAssessmentRows,
    patternConfig.version,
    bipolarType
  );
  const currentAssessmentDays = new Set(
    currentAssessments.map((assessment) => assessment.day)
  );
  const recentEpisodes = currentAssessments.filter(
    (assessment) =>
      assessment.tier !== "none" && assessment.day >= fourteenDaysAgo
  );

  const todayMood = await db
    .select({
      moodScore: dailyMood.moodScore,
      episodeState: dailyMood.episodeState,
      tags: dailyMood.tags,
      notes: dailyMood.notes,
    })
    .from(dailyMood)
    .where(eq(dailyMood.day, today))
    .limit(1);

  const trackedMeds = await db
    .select({
      id: medications.id,
      name: medications.name,
      dosage: medications.dosage,
      frequency: medications.frequency,
      doseSchedule: medications.doseSchedule,
      startDate: medications.startDate,
      endDate: medications.endDate,
    })
    .from(medications);

  const todayMedLogs = await db
    .select({
      medicationId: medicationLogs.medicationId,
      slot: medicationLogs.slot,
      taken: medicationLogs.taken,
    })
    .from(medicationLogs)
    .where(eq(medicationLogs.day, today));

  const availabilityData = await computeDataAvailability(30);

  const recentAnalysis = await db
    .select({
      day: dailyAnalysis.day,
      baselineHrv: dailyAnalysis.baselineHrv,
      baselineHeartRate: dailyAnalysis.baselineHeartRate,
      isAnomaly: dailyAnalysis.isAnomaly,
      anomalyDirection: dailyAnalysis.anomalyDirection,
      hrvZScore: dailyAnalysis.hrvZScore,
      heartRateZScore: dailyAnalysis.heartRateZScore,
    })
    .from(dailyAnalysis)
    .where(gte(dailyAnalysis.day, thirtyDaysAgo))
    .orderBy(desc(dailyAnalysis.day));

  const highestTier = recentEpisodes.length > 0
    ? recentEpisodes.reduce((best, ep) => {
        const rank = { alert: 3, warning: 2, watch: 1, none: 0 };
        const epRank = rank[ep.tier as keyof typeof rank] ?? 0;
        const bestRank = rank[best.tier as keyof typeof rank] ?? 0;
        return epRank > bestRank ? ep : best;
      })
    : null;

  const score = lastDailySleep[0] ?? null;
  const readiness = lastReadiness[0] ?? null;

  const avgSleep = averagePresent(
    recentSleep.map((entry) => entry.totalSleepDuration)
  );
  const measuredSleepNights = recentSleep.filter(
    (entry) => entry.totalSleepDuration != null && entry.totalSleepDuration > 0
  ).length;

  const sleepDelta =
    sleep?.totalSleepDuration && avgSleep
      ? sleep.totalSleepDuration - avgSleep
      : null;

  const chartData = recentSleep
    .filter(
      (entry) =>
        entry.totalSleepDuration != null && entry.totalSleepDuration > 0
    )
    .map((s) => {
      const heartRate = summarizeStoredSamples(s.hr5min);
      return {
        day: s.day,
        hours: +(s.totalSleepDuration! / 3600).toFixed(2),
        deep:
          s.deepSleepDuration != null
            ? +(s.deepSleepDuration / 3600).toFixed(2)
            : null,
        rem:
          s.remSleepDuration != null
            ? +(s.remSleepDuration / 3600).toFixed(2)
            : null,
        light:
          s.lightSleepDuration != null
            ? +(s.lightSleepDuration / 3600).toFixed(2)
            : null,
        efficiency: s.efficiency,
        hrv: s.averageHrv,
        hr: heartRate.average ?? s.averageHeartRate,
      };
    })
    .reverse();

  const analysisChartData = recentAnalysis
    .map((a) => {
      const patternFields = currentDailyPatternFields(
        a.day,
        {
          isAnomaly: a.isAnomaly,
          anomalyDirection: a.anomalyDirection,
        },
        currentAssessmentDays
      );
      return {
        day: a.day,
        baselineHrv: a.baselineHrv,
        baselineHeartRate: a.baselineHeartRate,
        ...patternFields,
        hrvZScore: a.hrvZScore,
        heartRateZScore: a.heartRateZScore,
      };
    })
    .reverse();

  const compositionData = recentSleep
    .slice(0, 14)
    .map((s) => {
      if (
        s.totalSleepDuration == null ||
        s.awakeTime == null ||
        s.totalSleepDuration + s.awakeTime <= 0
      ) {
        return null;
      }
      const total = s.totalSleepDuration + s.awakeTime;
      const percentOfTimeInBed = (duration: number | null): number | null =>
        duration != null ? +(((duration / total) * 100).toFixed(1)) : null;
      return {
        day: s.day,
        deep: percentOfTimeInBed(s.deepSleepDuration),
        rem: percentOfTimeInBed(s.remSleepDuration),
        light: percentOfTimeInBed(s.lightSleepDuration),
        awake: percentOfTimeInBed(s.awakeTime),
        deepMin:
          s.deepSleepDuration != null ? s.deepSleepDuration / 60 : null,
        remMin: s.remSleepDuration != null ? s.remSleepDuration / 60 : null,
        lightMin:
          s.lightSleepDuration != null ? s.lightSleepDuration / 60 : null,
        awakeMin: s.awakeTime / 60,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .reverse();

  const currentSleepHypnogram = sleep?.hypnogram5min ?? null;
  const currentSleepHr5min = sleep?.hr5min ?? null;
  const currentSleepBedtimeStart = sleep?.bedtimeStart ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>

      <DailyLogCard
        initialDay={today}
        medications={trackedMeds}
        initialMood={todayMood[0] ?? null}
        initialMedLogs={todayMedLogs}
      />

      {highestTier && (
        <div
          className={`rounded-lg p-4 ${
            highestTier.tier === "alert"
              ? "bg-red-500/10 border border-red-500/30 text-red-300"
              : highestTier.tier === "warning"
                ? "bg-amber-500/10 border border-amber-500/30 text-amber-300"
                : "bg-muted border text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                highestTier.tier === "alert"
                  ? "bg-red-500/20 text-red-300"
                  : highestTier.tier === "warning"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-blue-500/20 text-blue-300"
              }`}
            >
              {highestTier.tier.toUpperCase()}
            </span>
            <p className="font-medium">
              {recentEpisodes.length} flagged day{recentEpisodes.length !== 1 ? "s" : ""} in the last 14 days
            </p>
          </div>
          <p className="text-sm mt-1 opacity-80">
            {highestTier.direction === "hyper"
              ? "Higher-activation"
              : highestTier.direction === "hypo"
                ? "Lower-activation"
                : "Mixed"}{" "}
            personal-baseline pattern; this is not a mood-episode diagnosis.
          </p>
          <Link
            href="/dashboard/alerts"
            className="text-sm underline mt-2 inline-block"
          >
            View all alerts
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 items-start">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>
              Previous Night&apos;s Sleep · {previousNightLabel}
              <ResearchTooltip metric="sleepDuration" />
            </CardDescription>
            <CardTitle className="text-2xl">
              {formatDuration(sleep?.totalSleepDuration ?? null)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sleepDelta !== null && (
              <p
                className={`text-sm font-medium ${
                  Math.abs(sleepDelta) > 3600
                    ? sleepDelta > 0
                      ? "text-blue-400"
                      : "text-amber-400"
                    : "text-green-400"
                }`}
              >
                {formatDurationDelta(sleepDelta)} vs avg
              </p>
            )}
            {sleep && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatTime(sleep.bedtimeStart)} — {formatTime(sleep.bedtimeEnd)} ET
              </p>
            )}
            {!sleep && (
              <p className="text-sm text-muted-foreground">
                No sleep record is available for this ET sleep window yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col items-center py-3 md:py-4">
          <ScoreRing
            score={score?.score ?? null}
            label="Sleep Score"
            sublabel={score ? previousNightLabel : undefined}
          />
        </Card>

        <Card className="flex flex-col items-center py-3 md:py-4">
          <ScoreRing
            score={readiness?.score ?? null}
            label="Readiness"
            sublabel={readiness ? previousNightLabel : undefined}
          />
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last 30 Recorded Nights · Avg Sleep</CardDescription>
            <CardTitle className="text-2xl">
              {formatDuration(avgSleep)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Based on {measuredSleepNights} nights
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <ScoreBreakdown
          title="Sleep Score Breakdown"
          day={score ? previousNightLabel : undefined}
          contributors={[
            { name: "Deep Sleep", score: score?.contributorDeepSleep ?? null },
            { name: "Efficiency", score: score?.contributorEfficiency ?? null },
            { name: "Latency", score: score?.contributorLatency ?? null },
            { name: "REM Sleep", score: score?.contributorRemSleep ?? null },
            { name: "Restfulness", score: score?.contributorRestfulness ?? null },
            { name: "Timing", score: score?.contributorTiming ?? null },
            { name: "Total Sleep", score: score?.contributorTotalSleep ?? null },
          ]}
        />
        <ScoreBreakdown
          title="Readiness Breakdown"
          day={readiness ? previousNightLabel : undefined}
          contributors={[
            { name: "Activity Balance", score: readiness?.contributorActivityBalance ?? null },
            { name: "Body Temp", score: readiness?.contributorBodyTemperature ?? null },
            { name: "HRV Balance", score: readiness?.contributorHrvBalance ?? null },
            { name: "Prev Day Activity", score: readiness?.contributorPreviousDayActivity ?? null },
            { name: "Previous Night", score: readiness?.contributorPreviousNight ?? null },
            { name: "Recovery Index", score: readiness?.contributorRecoveryIndex ?? null },
            { name: "Resting HR", score: readiness?.contributorRestingHeartRate ?? null },
            { name: "Sleep Balance", score: readiness?.contributorSleepBalance ?? null },
          ]}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sleep Stages · Night of {previousNightLabel}</CardTitle>
          <CardDescription>
            Hypnogram with heart-rate overlay · ET
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentSleepHypnogram && currentSleepBedtimeStart ? (
            <HypnogramChart
              hypnogram={currentSleepHypnogram}
              hr5min={currentSleepHr5min}
              bedtimeStart={currentSleepBedtimeStart}
            />
          ) : (
            <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border px-4 text-center">
              <div className="max-w-md space-y-1">
                <p className="text-sm font-medium">
                  No sleep-stage record for the night of {previousNightLabel}
                </p>
                <p className="text-sm text-muted-foreground">
                  Older sleep remains available in the historical trends below.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <SleepTrendChart
          data={chartData}
          analysisData={analysisChartData.length > 0 ? analysisChartData : undefined}
        />
      )}

      {compositionData.length > 0 && (
        <SleepCompositionBar data={compositionData} />
      )}

      <DataAvailabilityCard data={availabilityData} />
    </div>
  );
}
