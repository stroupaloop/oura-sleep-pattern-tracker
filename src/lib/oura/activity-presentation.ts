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

export const ACTIVITY_COLORS: Record<ActivityClass, string> = {
  rest: "#60a5fa",
  inactive: "#a78bfa",
  low: "#34d399",
  medium: "#fbbf24",
  high: "#f87171",
};

export const NONWEAR_COLOR = "#6b7280";
export const UNAVAILABLE_ACTIVITY_COLOR = "#64748b";
export const HEART_RATE_LINE_COLOR = "#e5e7eb";

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
    fillOpacity: Number((0.3 + coverage * 0.5).toFixed(2)),
    isNonWear: false,
  };
}
