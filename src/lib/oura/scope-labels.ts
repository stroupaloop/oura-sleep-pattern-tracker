import type { OuraScope } from "./contracts";

const SCOPE_LABELS: Record<OuraScope, string> = {
  email: "email address",
  personal: "profile",
  daily: "sleep, readiness, activity and stress",
  heartrate: "heart rate",
  workout: "workouts",
  tag: "tags",
  session: "sessions",
  spo2: "blood oxygen",
  stress: "resilience",
  heart_health: "heart health (VO₂ max, cardiovascular age)",
};

/** "blood oxygen, resilience and heart health (VO₂ max, cardiovascular age)". */
export function formatOuraScopeList(scopes: readonly OuraScope[]): string {
  const labels = scopes.map((scope) => SCOPE_LABELS[scope]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}
