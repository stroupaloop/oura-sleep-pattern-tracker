/**
 * The self-reported mood scale, -3 to +3. Its color is an ordinal ramp in the
 * night-ink family: lower reads deeper, higher brighter, as in activation,
 * with no good or bad hue. Swatches never carry text; the signed number and
 * the label do.
 */
export const MOOD_SCALE = [
  { value: -3, label: "Very low", level: 0 },
  { value: -2, label: "Low", level: 1 },
  { value: -1, label: "Slightly low", level: 2 },
  { value: 0, label: "Neutral", level: 3 },
  { value: 1, label: "Slightly high", level: 4 },
  { value: 2, label: "High", level: 5 },
  { value: 3, label: "Very high", level: 6 },
] as const;

export type MoodValue = (typeof MOOD_SCALE)[number]["value"];

function entry(value: number) {
  return MOOD_SCALE.find((mood) => mood.value === Math.round(value)) ?? null;
}

export function moodLabel(value: number): string {
  return entry(value)?.label ?? "";
}

/** "+2", "0", "−1" with a true minus sign. */
export function formatMoodValue(value: number): string {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "0";
}

/** The mood's ramp color as a CSS value, for charts and swatch bars. */
export function moodColor(value: number): string {
  const mood = entry(value);
  return mood ? `var(--level-${mood.level})` : "var(--muted)";
}

const LEVEL_BG = [
  "bg-level-0",
  "bg-level-1",
  "bg-level-2",
  "bg-level-3",
  "bg-level-4",
  "bg-level-5",
  "bg-level-6",
] as const;

/** Tailwind background class for a mood swatch (written out for the compiler). */
export function moodSwatchClass(value: number): string {
  const mood = entry(value);
  return mood ? LEVEL_BG[mood.level] : "bg-muted";
}
