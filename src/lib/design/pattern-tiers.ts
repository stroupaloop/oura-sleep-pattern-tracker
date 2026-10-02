import type { Tone } from "./tone";

export type PatternTier = "watch" | "warning" | "alert";

const TIERS: Record<PatternTier, { label: string; tone: Tone; color: string }> = {
  watch: { label: "Watch", tone: "info", color: "var(--watch)" },
  warning: { label: "Warning", tone: "attention", color: "var(--attention)" },
  alert: { label: "Alert", tone: "alert", color: "var(--alert)" },
};

export function isPatternTier(value: unknown): value is PatternTier {
  return value === "watch" || value === "warning" || value === "alert";
}

/** "Watch", "Warning", "Alert", or "None" for an unflagged day. */
export function tierLabel(tier: string | null | undefined): string {
  return isPatternTier(tier) ? TIERS[tier].label : "None";
}

export function tierTone(tier: string | null | undefined): Tone {
  return isPatternTier(tier) ? TIERS[tier].tone : "neutral";
}

/** The tier's color as a CSS value, for charts. */
export function tierColor(tier: string | null | undefined): string {
  return isPatternTier(tier) ? TIERS[tier].color : "var(--muted-foreground)";
}
