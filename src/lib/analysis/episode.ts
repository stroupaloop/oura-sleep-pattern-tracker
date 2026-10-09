import { db } from "@/lib/db";
import { episodeAssessments } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { DetectionConfigValues, BipolarType } from "./config";
import { DailyAnalysisResult } from "./anomaly";
import { NIGHT_AGREES_AT, WindowResult, analyzeAllWindows } from "./window";
import { getReferencesForDirection } from "@/lib/research/references";
import { isNextCalendarDay } from "./baseline";
import {
  ALERT_SPAN_DAYS,
  concerningNightsInSpan,
  describePersistence,
  FlagTier,
  LOWER_VIEW_BREAK,
  LOWER_VIEW_DAYS,
  LOWER_VIEW_MIN_NIGHTS,
  Persistence,
} from "./persistence";
import {
  PATTERN_ALGORITHM_VERSION,
  PATTERN_SIGNAL_MODE,
} from "./provenance";

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
  /** Concerning nights behind the flag, out of the nights its rule looks at. */
  persistence?: Persistence;
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
  bipolarProfile: BipolarType;
  algorithmVersion: string;
  signalMode: string;
}

export function finiteMetricOrNull(
  value: number | null | undefined
): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

const TIER_RANK: Record<Tier, number> = { none: 0, watch: 1, warning: 2, alert: 3 };

interface TierRule {
  tier: FlagTier;
  minConfidence: number;
  minNights: number;
  /** Nights looked back over; an unbroken run when it equals `minNights`. */
  span: number;
  /** Count only nights that lean the pattern's way. */
  leaning: boolean;
}

function minConfidenceFor(tier: FlagTier, config: DetectionConfigValues): number {
  return tier === "alert"
    ? config.alertMinConfidence
    : tier === "warning"
      ? config.warningMinConfidence
      : config.watchMinConfidence;
}

const STRONGEST_FIRST: FlagTier[] = ["alert", "warning", "watch"];

/** Watch and Warning need an unbroken run; Alert needs enough of the last seven nights. */
function standardRules(config: DetectionConfigValues): TierRule[] {
  return [
    {
      tier: "alert",
      minConfidence: config.alertMinConfidence,
      minNights: config.alertMinDays,
      span: Math.max(config.alertMinDays, ALERT_SPAN_DAYS),
      leaning: true,
    },
    {
      tier: "warning",
      minConfidence: config.warningMinConfidence,
      minNights: config.warningMinDays,
      span: config.warningMinDays,
      leaning: false,
    },
    {
      tier: "watch",
      minConfidence: config.watchMinConfidence,
      minNights: config.watchMinDays,
      span: config.watchMinDays,
      leaning: false,
    },
  ];
}

/** The two-week rules, read only for a lower-activation lean. */
function lowerViewRules(config: DetectionConfigValues): TierRule[] {
  return STRONGEST_FIRST.map((tier) => ({
    tier,
    minConfidence: minConfidenceFor(tier, config),
    minNights: LOWER_VIEW_MIN_NIGHTS[tier],
    span: LOWER_VIEW_DAYS,
    leaning: true,
  }));
}

function strongestTierMet(
  rules: TierRule[],
  confidence: number,
  nights: DailyAnalysisResult[],
  run: number,
  concernThreshold: number,
  direction: "hyper" | "hypo" | null
): { tier: Tier; persistence: Persistence | null } {
  for (const rule of rules) {
    if (confidence < rule.minConfidence) continue;
    if (rule.span === rule.minNights) {
      if (run >= rule.minNights) {
        return { tier: rule.tier, persistence: { nights: run, span: run } };
      }
      continue;
    }
    const counted = concerningNightsInSpan(
      nights,
      concernThreshold,
      rule.span,
      rule.leaning && direction
        ? { direction, margin: NIGHT_AGREES_AT }
        : undefined
    );
    if (counted >= rule.minNights) {
      return { tier: rule.tier, persistence: { nights: counted, span: rule.span } };
    }
  }
  return { tier: "none", persistence: null };
}

function countConsecutiveConcerning(
  dailyResults: DailyAnalysisResult[],
  concernThreshold: number
): number {
  let count = 0;
  for (let i = dailyResults.length - 1; i >= 0; i--) {
    if (
      i < dailyResults.length - 1 &&
      !isNextCalendarDay(dailyResults[i].day, dailyResults[i + 1].day)
    ) {
      break;
    }
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
  baselines: Record<string, number>,
  config: DetectionConfigValues
): string[] {
  const drivers: string[] = [];
  const z = result.zScores;
  const m = result.metrics;
  const threshold = config.dailyAnomalyThreshold;

  if (Math.abs(z.sleep) > threshold) {
    const delta = m.totalSleepMinutes - baselines.sleep;
    const dir = delta > 0 ? "increased" : "reduced";
    drivers.push(`Sleep duration ${dir} ~${Math.abs(delta).toFixed(0)}min`);
  }
  if (Math.abs(z.hrv) > threshold) {
    const delta = m.avgHrv - baselines.hrv;
    const dir = delta > 0 ? "elevated" : "reduced";
    drivers.push(`HRV ${dir} ${Math.abs(delta).toFixed(0)}ms`);
  }
  if (Math.abs(z.hr) > threshold) {
    const delta = m.avgHeartRate - baselines.hr;
    const dir = delta > 0 ? "elevated" : "reduced";
    drivers.push(`Heart rate ${dir} ${Math.abs(delta).toFixed(0)}bpm`);
  }
  if (Math.abs(z.temperature) > threshold) {
    const dir = m.temperatureDelta > 0 ? "elevated" : "reduced";
    drivers.push(`Temperature ${dir} ${Math.abs(m.temperatureDelta).toFixed(1)}\u00b0`);
  }
  if (Math.abs(z.bedtime) > threshold) {
    const dir = z.bedtime > 0 ? "later" : "earlier";
    drivers.push(`Bedtime shifted ${dir}`);
  }
  if (Math.abs(z.efficiency) > threshold) {
    const dir = z.efficiency < 0 ? "decreased" : "increased";
    drivers.push(`Sleep efficiency ${dir}`);
  }
  if (Math.abs(z.latency) > threshold) {
    const dir = z.latency > 0 ? "increased" : "decreased";
    drivers.push(`Sleep onset latency ${dir}`);
  }
  if ((z.withinNightVar ?? 0) > threshold) {
    drivers.push("Within-night sleep variability elevated");
  }
  if (Math.abs(z.activity ?? 0) > threshold) {
    const dir = (z.activity ?? 0) > 0 ? "increased" : "decreased";
    drivers.push(`Activity level ${dir}`);
  }
  if ((z.circadianIV ?? 0) > threshold) {
    drivers.push("Circadian rhythm fragmentation increased");
  }
  if (Math.abs(z.deepPct ?? 0) > threshold) {
    const dir = (z.deepPct ?? 0) < 0 ? "decreased" : "increased";
    drivers.push(`Deep sleep ${dir}`);
  }
  if (Math.abs(z.remPct ?? 0) > threshold) {
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
  persistence: Persistence | null,
  drivers: string[]
): string {
  if (tier === "none" || !persistence) {
    if (confounderLikelihood > 0.5) {
      return "An isolated change was followed by a return toward baseline.";
    }
    return "No sustained pattern flag from the available data.";
  }

  const dirLabel =
    direction === "hyper"
      ? "higher-activation"
      : direction === "hypo"
        ? "lower-activation"
        : "mixed";

  const tierLabel =
    tier === "watch"
      ? "Early signal"
      : tier === "warning"
        ? "Emerging pattern"
        : "Strong pattern";

  const parts = [
    `${tierLabel}: ${dirLabel} pattern on ${describePersistence(persistence)} (evidence score ${confidence.toFixed(1)}/10).`,
  ];

  if (drivers.length > 0) {
    parts.push(`Key drivers: ${drivers.slice(0, 3).join(", ")}.`);
  }

  if (confounderLikelihood > 0.3) {
    parts.push(`Eased from its peak: ${(confounderLikelihood * 100).toFixed(0)}%.`);
  }

  return parts.join(" ");
}

function buildResearchContext(
  tier: Tier,
  direction: "hyper" | "hypo" | null,
  confidence: number,
  persistence: Persistence | null,
  drivers: string[],
  result: DailyAnalysisResult,
  config: DetectionConfigValues,
  moodCoverage?: number
): AlertResearchContext | null {
  if (tier === "none" || !persistence) return null;

  const dirLabel =
    direction === "hyper"
      ? "higher-activation"
      : direction === "hypo"
        ? "lower-activation"
        : "mixed";

  const headline =
    `Your available data matched this app's ${dirLabel} pattern rule on ${describePersistence(persistence)}`;

  const whatWeDetected: string[] = [];
  const detected = config.concernThreshold;
  const z = result.zScores;
  const m = result.metrics;
  const b = result.baselines;

  if (Math.abs(z.sleep) > detected) {
    const delta = Math.abs(m.totalSleepMinutes - b.sleep);
    const dir = z.sleep < 0 ? "decreased" : "increased";
    whatWeDetected.push(`Sleep duration ${dir} ${delta.toFixed(0)} min ${z.sleep < 0 ? "below" : "above"} your baseline`);
  }
  if ((z.withinNightVar ?? 0) > detected) {
    whatWeDetected.push(
      `Within-night sleep variability was ${(z.withinNightVar ?? 0).toFixed(1)} standard deviations above baseline`
    );
  }
  if (Math.abs(z.hrv) > detected) {
    const dir = z.hrv > 0 ? "elevated" : "decreased";
    whatWeDetected.push(`HRV ${dir} compared to your baseline`);
  }
  if (Math.abs(z.bedtime) > detected) {
    const dir = z.bedtime > 0 ? "later" : "earlier";
    whatWeDetected.push(`Bedtime shifted ${dir} than usual`);
  }
  if (Math.abs(z.temperature) > detected) {
    whatWeDetected.push(`Temperature ${z.temperature > 0 ? "elevated" : "lower"} compared to baseline`);
  }
  if (Math.abs(z.activity ?? 0) > detected) {
    whatWeDetected.push(`Activity levels ${(z.activity ?? 0) > 0 ? "increased" : "decreased"} from baseline`);
  }

  const refs = direction ? getReferencesForDirection(direction) : [];
  const topRef = refs[0];
  const whyItMatters = topRef
    ? `${topRef.finding} (${topRef.authors}, ${topRef.year})`
    : "Sleep and activity changes have been studied in relation to mood symptoms, but they do not establish that an episode is beginning.";

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
    note: !hasMood
      ? "Daily check-ins add symptom context that wearable data cannot provide"
      : null,
  };

  return {
    headline,
    whatWeDetected: whatWeDetected.slice(0, 4),
    whyItMatters,
    whatYouCanDo,
    researchIds: refs.slice(0, 3).map((r) => r.id),
    confidence:
      confidence >= config.alertMinConfidence
        ? "high"
        : confidence >= config.watchMinConfidence
          ? "moderate"
          : "low",
    disclaimer:
      "This tool tracks patterns for personal awareness. It is not a medical device and does not provide diagnoses. Always consult your healthcare provider for medical decisions.",
    dataCompleteness,
    persistence,
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
  const { best, lowerView } = analyzeAllWindows(
    recentDailyResults,
    allPriorResults,
    config,
    expectedDaysByWindow,
    bipolarType
  );

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
      bipolarProfile: bipolarType,
      algorithmVersion: PATTERN_ALGORITHM_VERSION,
      signalMode: PATTERN_SIGNAL_MODE,
    };
  }

  const drivers = computePrimaryDrivers(
    latestResult,
    latestResult.baselines,
    config
  );

  const bounceLimitFor = (window: WindowResult) =>
    window.direction === "hypo"
      ? Math.min(config.bounceBackThreshold + 0.2, 1.0)
      : config.bounceBackThreshold;

  let chosen = best;
  let { tier, persistence } = strongestTierMet(
    standardRules(config),
    best.confidence,
    recentDailyResults,
    consecutiveDays,
    config.concernThreshold,
    best.direction
  );

  // Nights that are unusual with no lean toward either side are worth a look
  // but not an escalation: a direction is what the higher tiers rest on.
  if (best.direction === null && TIER_RANK[tier] > TIER_RANK.watch) {
    tier = "watch";
  }
  if (tier !== "none" && best.bounceBackScore > bounceLimitFor(best)) {
    tier = "none";
    persistence = null;
  }

  const swungHigher = (latestResult.activation ?? 0) > LOWER_VIEW_BREAK;
  if (lowerView && !swungHigher) {
    const lower = strongestTierMet(
      lowerViewRules(config),
      lowerView.confidence,
      recentDailyResults,
      consecutiveDays,
      config.concernThreshold,
      "hypo"
    );
    if (
      TIER_RANK[lower.tier] > TIER_RANK[tier] &&
      lowerView.bounceBackScore <= bounceLimitFor(lowerView)
    ) {
      tier = lower.tier;
      persistence = lower.persistence;
      chosen = lowerView;
    }
  }

  // The same swing voids a "lower" label on the short windows, which also
  // look back: the flag stays, but it no longer says which way, and with no
  // direction it goes no higher than Watch.
  let direction = chosen.direction;
  if (direction === "hypo" && swungHigher && tier !== "none") {
    direction = null;
    if (TIER_RANK[tier] > TIER_RANK.watch) tier = "watch";
  }

  const confidence = chosen.confidence;
  const confounderLikelihood = Math.min(1, chosen.bounceBackScore);
  const summary = buildSummary(tier, direction, confidence, confounderLikelihood, persistence, drivers);
  const researchContext = buildResearchContext(
    tier,
    direction,
    confidence,
    persistence,
    drivers,
    latestResult,
    config
  );

  return {
    day,
    tier,
    direction,
    confidence,
    bestWindowDays: chosen.windowDays,
    bestWindow: chosen,
    consecutiveConcerningDays: consecutiveDays,
    confounderLikelihood,
    primaryDrivers: drivers,
    summary,
    researchContext,
    configVersion: config.version,
    bipolarProfile: bipolarType,
    algorithmVersion: PATTERN_ALGORITHM_VERSION,
    signalMode: PATTERN_SIGNAL_MODE,
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
      trendSlope: finiteMetricOrNull(w?.trendSlope),
      consistencyRatio: finiteMetricOrNull(w?.consistencyRatio),
      directionConsistency: finiteMetricOrNull(w?.directionConsistency),
      bounceBackScore: finiteMetricOrNull(w?.bounceBackScore),
      confounderLikelihood: result.confounderLikelihood,
      latencyCV: finiteMetricOrNull(w?.latencyCV),
      latencyCVZScore: finiteMetricOrNull(w?.latencyCVZScore),
      bedtimeCV: finiteMetricOrNull(w?.bedtimeCV),
      bedtimeCVZScore: finiteMetricOrNull(w?.bedtimeCVZScore),
      sleepDurationCV: finiteMetricOrNull(w?.sleepDurationCV),
      hrvCV: finiteMetricOrNull(w?.hrvCV),
      temperatureMean: finiteMetricOrNull(w?.temperatureMean),
      temperatureElevated: w?.temperatureElevated ? 1 : 0,
      missingDaysInWindow: w?.missingDaysInWindow ?? null,
      consecutiveConcerningDays: result.consecutiveConcerningDays,
      primaryDrivers: JSON.stringify(result.primaryDrivers),
      summary: result.summary,
      researchContext: result.researchContext ? JSON.stringify(result.researchContext) : null,
      configVersion: result.configVersion,
      bipolarProfile: result.bipolarProfile,
      algorithmVersion: result.algorithmVersion,
      signalMode: result.signalMode,
      evaluatedAt: now,
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
        bipolarProfile: sql`excluded.bipolar_profile`,
        algorithmVersion: sql`excluded.algorithm_version`,
        signalMode: sql`excluded.signal_mode`,
        evaluatedAt: sql`excluded.evaluated_at`,
      },
    });
}
