/**
 * Shared Recharts styling, so every chart reads from the same tokens.
 * Recharts accepts CSS variables in its color props.
 */
export const CHART = {
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
  baseline: "var(--muted-foreground)",
  attention: "var(--attention)",
  alert: "var(--alert)",
  calm: "var(--calm)",
  watch: "var(--watch)",
  primary: "var(--primary)",
  hrv: "var(--series-hrv)",
  heartRate: "var(--series-hr)",
  deep: "var(--stage-deep)",
  light: "var(--stage-light)",
  rem: "var(--stage-rem)",
  awake: "var(--stage-awake)",
} as const;

export const AXIS_TICK = { fill: CHART.axis, fontSize: 11 } as const;

export const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  borderColor: "var(--border)",
  borderRadius: "0.5rem",
  color: "var(--popover-foreground)",
} as const;

/** Series colors stay on the swatches; legend labels stay readable text. */
export function legendLabel(value: string) {
  return <span className="text-xs text-muted-foreground">{value}</span>;
}
