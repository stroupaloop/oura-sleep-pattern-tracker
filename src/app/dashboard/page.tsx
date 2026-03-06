export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  oauthTokens,
  sleepPeriods,
  dailySleep,
  dailyReadiness,
  dailyAnalysis,
  episodeAssessments,
} from "@/lib/db/schema";
import { desc, sql, and, gte, ne } from "drizzle-orm";
import { format, subDays } from "date-fns";
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
import { ResearchTooltip } from "@/components/research-tooltip";
import type { AlertResearchContext } from "@/lib/analysis/episode";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "--";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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

  const lastSleep = await db
    .select()
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(desc(sleepPeriods.day))
    .limit(1);

  const lastDailySleep = await db
    .select()
    .from(dailySleep)
    .orderBy(desc(dailySleep.day))
    .limit(1);

  const lastReadiness = await db
    .select()
    .from(dailyReadiness)
    .orderBy(desc(dailyReadiness.day))
    .limit(1);

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

  const recentScores = await db
    .select({ day: dailySleep.day, score: dailySleep.score })
    .from(dailySleep)
    .orderBy(desc(dailySleep.day))
    .limit(30);

  const fourteenDaysAgo = format(subDays(new Date(), 14), "yyyy-MM-dd");
  const recentEpisodes = await db
    .select({
      id: episodeAssessments.id,
      day: episodeAssessments.day,
      tier: episodeAssessments.tier,
      direction: episodeAssessments.direction,
      confidence: episodeAssessments.confidence,
      summary: episodeAssessments.summary,
      researchContext: episodeAssessments.researchContext,
      primaryDrivers: episodeAssessments.primaryDrivers,
    })
    .from(episodeAssessments)
    .where(
      and(
        ne(episodeAssessments.tier, "none"),
        gte(episodeAssessments.day, fourteenDaysAgo)
      )
    )
    .orderBy(desc(episodeAssessments.day));

  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
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

  const sleep = lastSleep[0] ?? null;
  const score = lastDailySleep[0] ?? null;
  const readiness = lastReadiness[0] ?? null;

  const avgSleep =
    recentSleep.length > 0
      ? recentSleep.reduce((sum, s) => sum + (s.totalSleepDuration ?? 0), 0) /
        recentSleep.length
      : null;

  const sleepDelta =
    sleep?.totalSleepDuration && avgSleep
      ? sleep.totalSleepDuration - avgSleep
      : null;

  const chartData = recentSleep
    .map((s) => ({
      day: s.day,
      hours: s.totalSleepDuration ? +(s.totalSleepDuration / 3600).toFixed(2) : 0,
      deep: s.deepSleepDuration ? +(s.deepSleepDuration / 3600).toFixed(2) : 0,
      rem: s.remSleepDuration ? +(s.remSleepDuration / 3600).toFixed(2) : 0,
      light: s.lightSleepDuration ? +(s.lightSleepDuration / 3600).toFixed(2) : 0,
      efficiency: s.efficiency ?? 0,
      hrv: s.averageHrv ?? 0,
      hr: s.averageHeartRate ?? 0,
    }))
    .reverse();

  const analysisChartData = recentAnalysis
    .map((a) => ({
      day: a.day,
      baselineHrv: a.baselineHrv,
      baselineHeartRate: a.baselineHeartRate,
      isAnomaly: a.isAnomaly,
      anomalyDirection: a.anomalyDirection,
      hrvZScore: a.hrvZScore,
      heartRateZScore: a.heartRateZScore,
    }))
    .reverse();

  const compositionData = recentSleep
    .slice(0, 14)
    .map((s) => {
      const total = (s.totalSleepDuration ?? 0) + (s.awakeTime ?? 0);
      if (total === 0)
        return {
          day: s.day,
          deep: 0,
          rem: 0,
          light: 0,
          awake: 0,
          deepMin: 0,
          remMin: 0,
          lightMin: 0,
          awakeMin: 0,
        };
      return {
        day: s.day,
        deep: +((((s.deepSleepDuration ?? 0) / total) * 100).toFixed(1)),
        rem: +((((s.remSleepDuration ?? 0) / total) * 100).toFixed(1)),
        light: +((((s.lightSleepDuration ?? 0) / total) * 100).toFixed(1)),
        awake: +((((s.awakeTime ?? 0) / total) * 100).toFixed(1)),
        deepMin: (s.deepSleepDuration ?? 0) / 60,
        remMin: (s.remSleepDuration ?? 0) / 60,
        lightMin: (s.lightSleepDuration ?? 0) / 60,
        awakeMin: (s.awakeTime ?? 0) / 60,
      };
    })
    .reverse();

  const lastNightHypnogram = recentSleep[0]?.hypnogram5min ?? null;
  const lastNightHr5min = recentSleep[0]?.hr5min ?? null;
  const lastNightBedtimeStart = recentSleep[0]?.bedtimeStart ?? null;

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>

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
              {recentEpisodes.length} episode{recentEpisodes.length !== 1 ? "s" : ""} detected in the last 14 days
            </p>
          </div>
          {(() => {
            let headline = highestTier.summary;
            try {
              const ctx: AlertResearchContext | null = highestTier.researchContext
                ? JSON.parse(highestTier.researchContext)
                : null;
              if (ctx?.headline) headline = ctx.headline;
            } catch {}
            return headline ? (
              <p className="text-sm mt-1 opacity-80">{headline}</p>
            ) : null;
          })()}
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
              Last Night&apos;s Sleep
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
                {sleepDelta > 0 ? "+" : ""}
                {formatDuration(sleepDelta)} vs avg
              </p>
            )}
            {sleep && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatTime(sleep.bedtimeStart)} — {formatTime(sleep.bedtimeEnd)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col items-center py-3 md:py-4">
          <ScoreRing
            score={score?.score ?? null}
            label="Sleep Score"
            sublabel={score?.day ?? undefined}
          />
        </Card>

        <Card className="flex flex-col items-center py-3 md:py-4">
          <ScoreRing
            score={readiness?.score ?? null}
            label="Readiness"
            sublabel={readiness?.day ?? undefined}
          />
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>30-Day Avg Sleep</CardDescription>
            <CardTitle className="text-2xl">
              {formatDuration(avgSleep)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Based on {recentSleep.length} nights
            </p>
          </CardContent>
        </Card>
      </div>

      {lastNightHypnogram && lastNightBedtimeStart && (
        <Card>
          <CardHeader>
            <CardTitle>Last Night&apos;s Sleep Stages</CardTitle>
            <CardDescription>
              Hypnogram with heart rate overlay
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HypnogramChart
              hypnogram={lastNightHypnogram}
              hr5min={lastNightHr5min}
              bedtimeStart={lastNightBedtimeStart}
            />
          </CardContent>
        </Card>
      )}

      {chartData.length > 0 && (
        <SleepTrendChart
          data={chartData}
          analysisData={analysisChartData.length > 0 ? analysisChartData : undefined}
        />
      )}

      {compositionData.length > 0 && (
        <SleepCompositionBar data={compositionData} />
      )}
    </div>
  );
}
