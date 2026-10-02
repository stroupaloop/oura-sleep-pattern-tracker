import type { OuraActivityCode } from "./activity";

export type ActivityClass =
  | "rest"
  | "inactive"
  | "low"
  | "medium"
  | "high";

export const ACTIVITY_LABELS: Record<ActivityClass, string> = {
  rest: "Resting",
  inactive: "Inactive",
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Activity classes on the ordinal ramp: brighter is more active, and a fully
 * classified hour draws at full strength so the lightness steps read as
 * designed. The class is always named beside the color.
 */
export const ACTIVITY_COLORS: Record<ActivityClass, string> = {
  rest: "var(--level-1)",
  inactive: "var(--level-2)",
  low: "var(--level-3)",
  medium: "var(--level-5)",
  high: "var(--level-6)",
};

export const NONWEAR_COLOR = "var(--muted)";
export const UNAVAILABLE_ACTIVITY_COLOR = "var(--faint-foreground)";
export const HEART_RATE_LINE_COLOR = "var(--series-hr)";

export const OURA_ACTIVITY_CLASSES: Partial<
  Record<OuraActivityCode, ActivityClass>
> = {
  1: "rest",
  2: "inactive",
  3: "low",
  4: "medium",
  5: "high",
};

interface ActivityBarPresentation {
  activityClass: ActivityClass | null;
  fill: string;
  fillOpacity: number;
  isNonWear: boolean;
}

export function getActivityBarPresentation(
  code: OuraActivityCode | null,
  classifiedMinutes: number
): ActivityBarPresentation {
  const coverage = Math.min(
    1,
    Math.max(0, Number.isFinite(classifiedMinutes) ? classifiedMinutes / 60 : 0)
  );

  if (code === 0) {
    return {
      activityClass: null,
      fill: NONWEAR_COLOR,
      fillOpacity: Number((0.3 + coverage * 0.4).toFixed(2)),
      isNonWear: true,
    };
  }

  const activityClass =
    code == null ? null : OURA_ACTIVITY_CLASSES[code] ?? null;
  if (!activityClass) {
    return {
      activityClass: null,
      fill: UNAVAILABLE_ACTIVITY_COLOR,
      fillOpacity: 0.3,
      isNonWear: false,
    };
  }

  return {
    activityClass,
    fill: ACTIVITY_COLORS[activityClass],
    fillOpacity: Number((0.4 + coverage * 0.6).toFixed(2)),
    isNonWear: false,
  };
}
