import { db } from "@/lib/db";
import { detectionConfig } from "@/lib/db/schema";
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
  sleepDuration: 0.20,
  bedtimeShift: 0.15,
  wakeTimeShift: 0.10,
  hrv: 0.15,
  heartRate: 0.10,
  latency: 0.08,
  temperatureDelta: 0.10,
  restlessPeriods: 0.05,
  sleepEfficiency: 0.07,
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
