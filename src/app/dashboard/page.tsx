export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  oauthTokens,
  sleepPeriods,
  dailySleep,
  dailyReadiness,
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

  // Get last 30 days of sleep for chart
  const recentSleep = await db
    .select({
      day: sleepPeriods.day,
      totalSleepDuration: sleepPeriods.totalSleepDuration,
      deepSleepDuration: sleepPeriods.deepSleepDuration,
      remSleepDuration: sleepPeriods.remSleepDuration,
      lightSleepDuration: sleepPeriods.lightSleepDuration,
      efficiency: sleepPeriods.efficiency,
      averageHrv: sleepPeriods.averageHrv,
      averageHeartRate: sleepPeriods.averageHeartRate,
      bedtimeStart: sleepPeriods.bedtimeStart,
      bedtimeEnd: sleepPeriods.bedtimeEnd,
    })
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(desc(sleepPeriods.day))
    .limit(30);

  // Get last 30 days of daily scores
  const recentScores = await db
    .select({ day: dailySleep.day, score: dailySleep.score })
    .from(dailySleep)
    .orderBy(desc(dailySleep.day))
    .limit(30);

  // Get recent episode assessments (last 14 days)
  const fourteenDaysAgo = format(subDays(new Date(), 14), "yyyy-MM-dd");
  const recentEpisodes = await db
    .select()
    .from(episodeAssessments)
    .where(
      and(
        ne(episodeAssessments.tier, "none"),
        gte(episodeAssessments.day, fourteenDaysAgo)
      )
    )
    .orderBy(desc(episodeAssessments.day));

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

  // Compute 30-day average sleep duration
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {highestTier && (
        <div
          className={`rounded-lg p-4 ${
            highestTier.tier === "alert"
              ? "bg-red-50 border border-red-200 text-red-900"
              : highestTier.tier === "warning"
                ? "bg-amber-50 border border-amber-200 text-amber-900"
                : "bg-muted border text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded ${
                highestTier.tier === "alert"
                  ? "bg-red-200 text-red-900"
                  : highestTier.tier === "warning"
                    ? "bg-amber-200 text-amber-900"
                    : "bg-blue-200 text-blue-900"
              }`}
            >
              {highestTier.tier.toUpperCase()}
            </span>
            <p className="font-medium">
              {recentEpisodes.length} episode{recentEpisodes.length !== 1 ? "s" : ""} detected in the last 14 days
            </p>
          </div>
          {highestTier.summary && (
            <p className="text-sm mt-1 opacity-80">{highestTier.summary}</p>
          )}
          <Link
            href="/dashboard/alerts"
            className="text-sm underline mt-2 inline-block"
          >
            View all alerts
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Night&apos;s Sleep</CardDescription>
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
                      ? "text-blue-500"
                      : "text-amber-500"
                    : "text-green-500"
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

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sleep Score</CardDescription>
            <CardTitle className="text-2xl">{score?.score ?? "--"}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {score?.day ?? "No data"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Readiness</CardDescription>
            <CardTitle className="text-2xl">
              {readiness?.score ?? "--"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {readiness?.day ?? "No data"}
            </p>
          </CardContent>
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

      {chartData.length > 0 && <SleepTrendChart data={chartData} />}
    </div>
  );
}
