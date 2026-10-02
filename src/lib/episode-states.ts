/** The self-reported episode states, shared by every page that offers them. */
export const EPISODE_STATES = [
  { value: "none", label: "None" },
  { value: "depressive", label: "Depressive" },
  { value: "hypomanic", label: "Hypomanic" },
  { value: "manic", label: "Manic" },
  { value: "mixed", label: "Mixed" },
] as const;

export type EpisodeState = (typeof EPISODE_STATES)[number]["value"];

export function isEpisodeState(value: unknown): value is EpisodeState {
  return EPISODE_STATES.some((state) => state.value === value);
}

/**
 * How a self-reported episode is marked in charts: a shape and a mood-ramp
 * level, always next to its words. Shapes, not hues, tell the states apart.
 */
export const EPISODE_MARKERS: Record<
  Exclude<EpisodeState, "none">,
  { shape: "down" | "up" | "diamond"; level: number }
> = {
  depressive: { shape: "down", level: 0 },
  hypomanic: { shape: "up", level: 5 },
  manic: { shape: "up", level: 6 },
  mixed: { shape: "diamond", level: 3 },
};

export function episodeLabel(value: string | null | undefined): string {
  return EPISODE_STATES.find((state) => state.value === value)?.label ?? "None";
}
