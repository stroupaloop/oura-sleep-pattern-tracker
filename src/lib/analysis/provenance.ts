import type { BipolarType } from "./config";

export const PATTERN_ALGORITHM_VERSION = "2026.08.1";
export const PATTERN_SIGNAL_MODE = "wearable-only";

export interface PatternProvenance {
  configVersion: number | null;
  bipolarProfile: string | null;
  algorithmVersion: string | null;
  signalMode: string | null;
}

export interface DailyPatternFlags {
  isAnomaly: number | null;
  anomalyDirection: string | null;
}

export interface DailyPatternScore extends DailyPatternFlags {
  anomalyScore: number | null;
}

export function hasCurrentPatternProvenance(
  value: PatternProvenance,
  configVersion: number,
  bipolarType: BipolarType
): boolean {
  return (
    value.configVersion === configVersion &&
    value.bipolarProfile === bipolarType &&
    value.algorithmVersion === PATTERN_ALGORITHM_VERSION &&
    value.signalMode === PATTERN_SIGNAL_MODE
  );
}

export function filterCurrentPatternAssessments<
  T extends PatternProvenance,
>(
  values: readonly T[],
  configVersion: number,
  bipolarType: BipolarType
): T[] {
  return values.filter((value) =>
    hasCurrentPatternProvenance(value, configVersion, bipolarType)
  );
}

export function currentDailyPatternFields(
  day: string,
  fields: DailyPatternScore,
  currentAssessmentDays: ReadonlySet<string>
): DailyPatternScore;
export function currentDailyPatternFields(
  day: string,
  fields: DailyPatternFlags,
  currentAssessmentDays: ReadonlySet<string>
): DailyPatternFlags;
export function currentDailyPatternFields(
  day: string,
  fields: DailyPatternFlags & { anomalyScore?: number | null },
  currentAssessmentDays: ReadonlySet<string>
): DailyPatternFlags & { anomalyScore?: number | null } {
  if (currentAssessmentDays.has(day)) return fields;

  return {
    ...fields,
    isAnomaly: null,
    anomalyDirection: null,
    ...("anomalyScore" in fields ? { anomalyScore: null } : {}),
  };
}
