import { db } from "@/lib/db";
import { episodeAssessments } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { DetectionConfigValues, BipolarType, getBipolarProfile } from "./config";
import { DailyAnalysisResult } from "./anomaly";
import { WindowResult, analyzeAllWindows } from "./window";
import { getReferencesForDirection } from "@/lib/research/references";

export type Tier = "none" | "watch" | "warning" | "alert";

export interface AlertResearchContext {
  headline: string;
  whatWeDetected: string[];
  whyItMatters: string;
  whatYouCanDo: string[];
  researchIds: string[];
  confidence: string;
  disclaimer: string;
  dataCompleteness?: {
    moodLogged: boolean;
    moodCoverage: number;
    note: string | null;
  };
}

export interface EpisodeResult {
  day: string;
  tier: Tier;
  direction: "hyper" | "hypo" | null;
  confidence: number;
  bestWindowDays: number | null;
  bestWindow: WindowResult | null;
  consecutiveConcerningDays: number;
  confounderLikelihood: number;
  primaryDrivers: string[];
  summary: string;
  researchContext: AlertResearchContext | null;
  configVersion: number;
}

function countConsecutiveConcerning(
  dailyResults: DailyAnalysisResult[],
  concernThreshold: number
): number {
  let count = 0;
  for (let i = dailyResults.length - 1; i >= 0; i--) {
    if (dailyResults[i].compositeScore > concernThreshold) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function computePrimaryDrivers(
  result: DailyAnalysisResult,
  baselines: Record<string, number>
): string[] {
  const drivers: string[] = [];
  const z = result.zScores;
  const m = result.metrics;

  if (Math.abs(z.sleep) > 1.5) {
    const delta = m.totalSleepMinutes - baselines.sleep;
    const dir = delta > 0 ? "increased" : "reduced";
    drivers.push(`Sleep duration ${dir} ~${Math.abs(delta).toFixed(0)}min`);
  }
  if (Math.abs(z.hrv) > 1.5) {
    const delta = m.avgHrv - baselines.hrv;
    const dir = delta > 0 ? "elevated" : "reduced";
    drivers.push(`HRV ${dir} ${Math.abs(delta).toFixed(0)}ms`);
  }
  if (Math.abs(z.hr) > 1.5) {
    const delta = m.avgHeartRate - baselines.hr;
    const dir = delta > 0 ? "elevated" : "reduced";
    drivers.push(`Heart rate ${dir} ${Math.abs(delta).toFixed(0)}bpm`);
  }
  if (Math.abs(z.temperature) > 1.0) {
    const dir = m.temperatureDelta > 0 ? "elevated" : "reduced";
    drivers.push(`Temperature ${dir} ${Math.abs(m.temperatureDelta).toFixed(1)}\u00b0`);
  }
  if (Math.abs(z.bedtime) > 1.5) {
    const dir = z.bedtime > 0 ? "later" : "earlier";
    drivers.push(`Bedtime shifted ${dir}`);
  }
  if (Math.abs(z.efficiency) > 1.5) {
    const dir = z.efficiency < 0 ? "decreased" : "increased";
    drivers.push(`Sleep efficiency ${dir}`);
  }
  if (Math.abs(z.latency) > 1.5) {
    const dir = z.latency > 0 ? "increased" : "decreased";
    drivers.push(`Sleep onset latency ${dir}`);
  }
  if ((z.withinNightVar ?? 0) > 1.5) {
    drivers.push("Within-night sleep variability elevated");
  }
  if (Math.abs(z.activity ?? 0) > 1.5) {
    const dir = (z.activity ?? 0) > 0 ? "increased" : "decreased";
    drivers.push(`Activity level ${dir}`);
  }
  if ((z.circadianIV ?? 0) > 1.5) {
    drivers.push("Circadian rhythm fragmentation increased");
  }
  if (Math.abs(z.deepPct ?? 0) > 1.5) {
    const dir = (z.deepPct ?? 0) < 0 ? "decreased" : "increased";
    drivers.push(`Deep sleep ${dir}`);
  }
  if (Math.abs(z.remPct ?? 0) > 1.5) {
    const dir = (z.remPct ?? 0) < 0 ? "decreased" : "increased";
    drivers.push(`REM sleep ${dir}`);
  }

  return drivers;
}

function buildSummary(
  tier: Tier,
  direction: "hyper" | "hypo" | null,
  confidence: number,
  confounderLikelihood: number,
  consecutiveDays: number,
  drivers: string[]
): string {
  if (tier === "none") {
    if (confounderLikelihood > 0.5) {
      return "Isolated disruption detected \u2014 likely a confounder (alcohol, travel, late night). Pattern has resolved.";
    }
    return "Sleep patterns within normal range.";
  }

  const dirLabel =
    direction === "hyper"
      ? "hypomanic-pattern"
      : direction === "hypo"
        ? "depressive-pattern"
        : "mixed-pattern";

  const tierLabel =
    tier === "watch"
      ? "Early signal"
      : tier === "warning"
        ? "Emerging pattern"
        : "Strong pattern";

  const parts = [
    `${tierLabel}: ${consecutiveDays}-day ${dirLabel} disruption (confidence ${confidence.toFixed(1)}/10).`,
  ];

  if (drivers.length > 0) {
    parts.push(`Key drivers: ${drivers.slice(0, 3).join(", ")}.`);
  }

  if (confounderLikelihood > 0.3) {
    parts.push(`Note: ${(confounderLikelihood * 100).toFixed(0)}% confounder probability \u2014 pattern may resolve.`);
  }

  return parts.join(" ");
}

function buildResearchContext(
  tier: Tier,
  direction: "hyper" | "hypo" | null,
  confidence: number,
  consecutiveDays: number,
  drivers: string[],
  result: DailyAnalysisResult,
  moodCoverage?: number
): AlertResearchContext | null {
  if (tier === "none") return null;

  const dirLabel = direction === "hyper" ? "hypomanic" : direction === "hypo" ? "depressive" : "mood";

  const headline =
    `Your sleep patterns over the last ${consecutiveDays} day${consecutiveDays !== 1 ? "s" : ""} show signs consistent with early ${dirLabel} changes`;

  const whatWeDetected: string[] = [];
  const z = result.zScores;
  const m = result.metrics;
  const b = result.baselines;

  if (Math.abs(z.sleep) > 1.0) {
    const delta = Math.abs(m.totalSleepMinutes - b.sleep);
    const dir = z.sleep < 0 ? "decreased" : "increased";
    whatWeDetected.push(`Sleep duration ${dir} ${delta.toFixed(0)} min ${z.sleep < 0 ? "below" : "above"} your baseline`);
  }
  if ((z.withinNightVar ?? 0) > 1.0) {
    whatWeDetected.push(`Within-night sleep variability increased ${((z.withinNightVar ?? 0)).toFixed(1)}x above baseline`);
  }
  if (Math.abs(z.hrv) > 1.0) {
    const dir = z.hrv > 0 ? "elevated" : "decreased";
    whatWeDetected.push(`HRV ${dir} compared to your baseline`);
  }
  if (Math.abs(z.bedtime) > 1.0) {
    const dir = z.bedtime > 0 ? "later" : "earlier";
    whatWeDetected.push(`Bedtime shifted ${dir} than usual`);
  }
  if (Math.abs(z.temperature) > 1.0) {
    whatWeDetected.push(`Temperature ${z.temperature > 0 ? "elevated" : "lower"} compared to baseline`);
  }
  if (Math.abs(z.activity ?? 0) > 1.0) {
    whatWeDetected.push(`Activity levels ${(z.activity ?? 0) > 0 ? "increased" : "decreased"} from baseline`);
  }

  const refs = direction ? getReferencesForDirection(direction) : [];
  const topRef = refs[0];
  const whyItMatters = topRef
    ? `${topRef.finding} (${topRef.authors}, ${topRef.year})`
    : "Research shows that changes in sleep and activity patterns can signal mood episode onset days before symptoms become apparent.";

  const whatYouCanDo =
    direction === "hyper"
      ? [
          "Track your mood and energy levels today",
          "Maintain your regular bedtime tonight",
          "Reach out to your care team if you notice changes",
        ]
      : [
          "Try to maintain regular sleep and wake times",
          "Consider light physical activity today",
          "Reach out to your care team if you notice changes",
        ];

  const hasMood = (moodCoverage ?? 0) > 0.7;
  const dataCompleteness = {
    moodLogged: hasMood,
    moodCoverage: moodCoverage ?? 0,
    note: !hasMood ? "Adding daily check-ins improves detection accuracy by ~20%" : null,
  };

  return {
    headline,
    whatWeDetected: whatWeDetected.slice(0, 4),
    whyItMatters,
    whatYouCanDo,
    researchIds: refs.slice(0, 3).map((r) => r.id),
    confidence: confidence >= 5 ? "high" : confidence >= 2 ? "moderate" : "low",
    disclaimer:
      "This tool tracks patterns for personal awareness. It is not a medical device and does not provide diagnoses. Always consult your healthcare provider for medical decisions.",
    dataCompleteness,
  };
}

export function assessEpisode(
  day: string,
  recentDailyResults: DailyAnalysisResult[],
  allPriorResults: DailyAnalysisResult[],
  config: DetectionConfigValues,
  expectedDaysByWindow?: Record<number, number>,
  bipolarType: BipolarType = "unspecified"
): EpisodeResult {
  const { best, all: _all } = analyzeAllWindows(recentDailyResults, allPriorResults, config, expectedDaysByWindow, bipolarType);

  const consecutiveDays = countConsecutiveConcerning(recentDailyResults, config.concernThreshold);
  const latestResult = recentDailyResults[recentDailyResults.length - 1];

  if (!best || !latestResult) {
    return {
      day,
      tier: "none",
      direction: null,
      confidence: 0,
      bestWindowDays: null,
      bestWindow: null,
      consecutiveConcerningDays: 0,
      confounderLikelihood: 0,
      primaryDrivers: [],
      summary: "Insufficient data for episode assessment.",
      researchContext: null,
      configVersion: config.version,
    };
  }

  const confidence = best.confidence;
  const confounderLikelihood = Math.min(1, best.bounceBackScore);
  const drivers = computePrimaryDrivers(latestResult, latestResult.baselines);

  let tier: Tier = "none";
  if (
    confidence >= config.alertMinConfidence &&
    consecutiveDays >= config.alertMinDays
  ) {
    tier = "alert";
  } else if (
    confidence >= config.warningMinConfidence &&
    consecutiveDays >= config.warningMinDays
  ) {
    tier = "warning";
  } else if (
    confidence >= config.watchMinConfidence &&
    consecutiveDays >= config.watchMinDays
  ) {
    tier = "watch";
  }

  const profile = getBipolarProfile(bipolarType);
  const effectiveBounceThreshold = best.direction === "hypo"
    ? Math.min(config.bounceBackThreshold + 0.2, 1.0)
    : config.bounceBackThreshold;
  if (tier !== "none" && best.bounceBackScore > effectiveBounceThreshold) {
    tier = "none";
  }

  const direction = best.direction;
  const summary = buildSummary(tier, direction, confidence, confounderLikelihood, consecutiveDays, drivers);
  const researchContext = buildResearchContext(tier, direction, confidence, consecutiveDays, drivers, latestResult);

  return {
    day,
    tier,
    direction,
    confidence,
    bestWindowDays: best.windowDays,
    bestWindow: best,
    consecutiveConcerningDays: consecutiveDays,
    confounderLikelihood,
    primaryDrivers: drivers,
    summary,
    researchContext,
    configVersion: config.version,
  };
}

export async function upsertEpisodeAssessment(result: EpisodeResult) {
  const now = Math.floor(Date.now() / 1000);
  const w = result.bestWindow;

  await db
    .insert(episodeAssessments)
    .values({
      day: result.day,
      tier: result.tier,
      direction: result.direction,
      confidence: result.confidence,
      bestWindowDays: result.bestWindowDays,
      trendSlope: w?.trendSlope ?? null,
      consistencyRatio: w?.consistencyRatio ?? null,
      directionConsistency: w?.directionConsistency ?? null,
      bounceBackScore: w?.bounceBackScore ?? null,
      confounderLikelihood: result.confounderLikelihood,
      latencyCV: w?.latencyCV ?? null,
      latencyCVZScore: w?.latencyCVZScore ?? null,
      bedtimeCV: w?.bedtimeCV ?? null,
      bedtimeCVZScore: w?.bedtimeCVZScore ?? null,
      sleepDurationCV: w?.sleepDurationCV ?? null,
      hrvCV: w?.hrvCV ?? null,
      temperatureMean: w?.temperatureMean ?? null,
      temperatureElevated: w?.temperatureElevated ? 1 : 0,
      missingDaysInWindow: w?.missingDaysInWindow ?? null,
      consecutiveConcerningDays: result.consecutiveConcerningDays,
      primaryDrivers: JSON.stringify(result.primaryDrivers),
      summary: result.summary,
      researchContext: result.researchContext ? JSON.stringify(result.researchContext) : null,
      configVersion: result.configVersion,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: episodeAssessments.day,
      set: {
        tier: sql`excluded.tier`,
        direction: sql`excluded.direction`,
        confidence: sql`excluded.confidence`,
        bestWindowDays: sql`excluded.best_window_days`,
        trendSlope: sql`excluded.trend_slope`,
        consistencyRatio: sql`excluded.consistency_ratio`,
        directionConsistency: sql`excluded.direction_consistency`,
        bounceBackScore: sql`excluded.bounce_back_score`,
        confounderLikelihood: sql`excluded.confounder_likelihood`,
        latencyCV: sql`excluded.latency_cv`,
        latencyCVZScore: sql`excluded.latency_cv_z_score`,
        bedtimeCV: sql`excluded.bedtime_cv`,
        bedtimeCVZScore: sql`excluded.bedtime_cv_z_score`,
        sleepDurationCV: sql`excluded.sleep_duration_cv`,
        hrvCV: sql`excluded.hrv_cv`,
        temperatureMean: sql`excluded.temperature_mean`,
        temperatureElevated: sql`excluded.temperature_elevated`,
        missingDaysInWindow: sql`excluded.missing_days_in_window`,
        consecutiveConcerningDays: sql`excluded.consecutive_concerning_days`,
        primaryDrivers: sql`excluded.primary_drivers`,
        summary: sql`excluded.summary`,
        researchContext: sql`excluded.research_context`,
        configVersion: sql`excluded.config_version`,
      },
    });
}
