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
