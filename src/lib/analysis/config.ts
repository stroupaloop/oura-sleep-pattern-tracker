import { db } from "@/lib/db";
import { detectionConfig, users } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface MetricWeights {
  sleepDuration: number;
  bedtimeShift: number;
  wakeTimeShift: number;
  hrv: number;
  heartRate: number;
  latency: number;
  temperatureDelta: number;
  restlessPeriods: number;
  sleepEfficiency: number;
  deepPct: number;
  remPct: number;
  withinNightVariability: number;
  activityLevel: number;
  circadianRegularity: number;
}

export type BipolarType = "bp1" | "bp2" | "unspecified";

export interface BipolarProfile {
  hyperBounceBackMultiplier: number;
  hypoBounceBackMultiplier: number;
  hyperSignalThreshold: number;
  variabilityWeight: number;
  activityWeight: number;
  circadianWeight: number;
}

const BIPOLAR_PROFILES: Record<BipolarType, BipolarProfile> = {
  bp1: {
    hyperBounceBackMultiplier: 0.35,
    hypoBounceBackMultiplier: 0.35,
    hyperSignalThreshold: 1.5,
    variabilityWeight: 0.10,
    activityWeight: 0.04,
    circadianWeight: 0.04,
  },
  bp2: {
    hyperBounceBackMultiplier: 0.50,
    hypoBounceBackMultiplier: 0.35,
    hyperSignalThreshold: 1.0,
    variabilityWeight: 0.20,
    activityWeight: 0.04,
    circadianWeight: 0.04,
  },
  unspecified: {
    hyperBounceBackMultiplier: 0.50,
    hypoBounceBackMultiplier: 0.35,
    hyperSignalThreshold: 1.0,
    variabilityWeight: 0.10,
    activityWeight: 0.04,
    circadianWeight: 0.04,
  },
};

export function getBipolarProfile(type: BipolarType): BipolarProfile {
  return BIPOLAR_PROFILES[type] ?? BIPOLAR_PROFILES.unspecified;
}

export interface AbsoluteThresholds {
  minSleepMinutes: number;
  maxHeartRate: number;
  minHrv: number;
  minEfficiency: number;
  maxBedtimeShiftMinutes: number;
}

export interface DetectionConfigValues {
  version: number;
  baselineDays: number;
  minBaselineDays: number;
  baselineTrimPct: number;
  concernThreshold: number;
  dailyAnomalyThreshold: number;
  watchMinConfidence: number;
  watchMinDays: number;
  warningMinConfidence: number;
  warningMinDays: number;
  alertMinConfidence: number;
  alertMinDays: number;
  bounceBackThreshold: number;
  metricWeights: MetricWeights;
  absoluteThresholds: AbsoluteThresholds;
}

export const DEFAULT_WEIGHTS: MetricWeights = {
  sleepDuration: 0.15,
  bedtimeShift: 0.10,
  wakeTimeShift: 0.08,
  hrv: 0.12,
  heartRate: 0.08,
  latency: 0.06,
  temperatureDelta: 0.08,
  restlessPeriods: 0.03,
  sleepEfficiency: 0.06,
  deepPct: 0.05,
  remPct: 0.05,
  withinNightVariability: 0.06,
  activityLevel: 0.04,
  circadianRegularity: 0.04,
};

export const DEFAULT_ABSOLUTE_THRESHOLDS: AbsoluteThresholds = {
  minSleepMinutes: 300,
  maxHeartRate: 80,
  minHrv: 20,
  minEfficiency: 70,
  maxBedtimeShiftMinutes: 120,
};

export const DEFAULT_CONFIG: DetectionConfigValues = {
  version: 1,
  baselineDays: 30,
  minBaselineDays: 14,
  baselineTrimPct: 0.10,
  concernThreshold: 1.0,
  dailyAnomalyThreshold: 1.5,
  watchMinConfidence: 2.0,
  watchMinDays: 2,
  warningMinConfidence: 3.5,
  warningMinDays: 3,
  alertMinConfidence: 5.0,
  alertMinDays: 5,
  bounceBackThreshold: 0.6,
  metricWeights: DEFAULT_WEIGHTS,
  absoluteThresholds: DEFAULT_ABSOLUTE_THRESHOLDS,
};

export const SENSITIVITY_PRESETS = {
  low: {
    concernThreshold: 1.3,
    dailyAnomalyThreshold: 2.0,
    watchMinConfidence: 2.5,
    warningMinConfidence: 4.5,
    alertMinConfidence: 6.0,
    bounceBackThreshold: 0.5,
  },
  medium: {
    concernThreshold: 1.0,
    dailyAnomalyThreshold: 1.5,
    watchMinConfidence: 2.0,
    warningMinConfidence: 3.5,
    alertMinConfidence: 5.0,
    bounceBackThreshold: 0.6,
  },
  high: {
    concernThreshold: 0.8,
    dailyAnomalyThreshold: 1.2,
    watchMinConfidence: 1.5,
    warningMinConfidence: 2.5,
    alertMinConfidence: 4.0,
    bounceBackThreshold: 0.7,
  },
} as const;

export async function loadActiveConfig(): Promise<DetectionConfigValues> {
  const rows = await db
    .select()
    .from(detectionConfig)
    .where(eq(detectionConfig.isActive, 1))
    .orderBy(desc(detectionConfig.version))
    .limit(1);

  if (rows.length === 0) return DEFAULT_CONFIG;

  const row = rows[0];
  let weights: MetricWeights;
  try {
    weights = JSON.parse(row.metricWeights);
  } catch {
    weights = DEFAULT_WEIGHTS;
  }

  return {
    version: row.version,
    baselineDays: row.baselineDays,
    minBaselineDays: row.minBaselineDays,
    baselineTrimPct: row.baselineTrimPct,
    concernThreshold: row.concernThreshold,
    dailyAnomalyThreshold: row.dailyAnomalyThreshold,
    watchMinConfidence: row.watchMinConfidence,
    watchMinDays: row.watchMinDays,
    warningMinConfidence: row.warningMinConfidence,
    warningMinDays: row.warningMinDays,
    alertMinConfidence: row.alertMinConfidence,
    alertMinDays: row.alertMinDays,
    bounceBackThreshold: row.bounceBackThreshold,
    metricWeights: weights,
    absoluteThresholds: DEFAULT_ABSOLUTE_THRESHOLDS,
  };
}

export async function loadBipolarType(): Promise<BipolarType> {
  const rows = await db.select({ bipolarType: users.bipolarType }).from(users).limit(1);
  if (rows.length === 0) return "unspecified";
  const val = rows[0].bipolarType;
  if (val === "bp1" || val === "bp2") return val;
  return "unspecified";
}

export async function createConfig(
  overrides: Partial<Omit<DetectionConfigValues, "version">> & { notes?: string }
): Promise<DetectionConfigValues> {
  const current = await loadActiveConfig();
  const merged = { ...DEFAULT_CONFIG, ...current, ...overrides };

  const maxVersion = await db
    .select({ max: sql<number>`max(${detectionConfig.version})` })
    .from(detectionConfig);
  const nextVersion = (maxVersion[0]?.max ?? 0) + 1;

  await db
    .update(detectionConfig)
    .set({ isActive: 0 })
    .where(eq(detectionConfig.isActive, 1));

  await db.insert(detectionConfig).values({
    version: nextVersion,
    baselineDays: merged.baselineDays,
    minBaselineDays: merged.minBaselineDays,
    baselineTrimPct: merged.baselineTrimPct,
    concernThreshold: merged.concernThreshold,
    dailyAnomalyThreshold: merged.dailyAnomalyThreshold,
    watchMinConfidence: merged.watchMinConfidence,
    watchMinDays: merged.watchMinDays,
    warningMinConfidence: merged.warningMinConfidence,
    warningMinDays: merged.warningMinDays,
    alertMinConfidence: merged.alertMinConfidence,
    alertMinDays: merged.alertMinDays,
    bounceBackThreshold: merged.bounceBackThreshold,
    metricWeights: JSON.stringify(merged.metricWeights),
    hyperSignals: null,
    hypoSignals: null,
    isActive: 1,
    notes: overrides.notes ?? null,
    createdAt: Math.floor(Date.now() / 1000),
  });

  return { ...merged, version: nextVersion };
}
