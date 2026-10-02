/** Oura's bands for its 0-100 scores, with this system's tones. */
export function scoreBand(score: number): {
  label: string;
  text: string;
  fill: string;
  color: string;
} {
  if (score >= 85) {
    return { label: "Optimal", text: "text-calm", fill: "bg-calm", color: "var(--calm)" };
  }
  if (score >= 70) {
    return { label: "Good", text: "text-calm", fill: "bg-calm/70", color: "var(--calm)" };
  }
  if (score >= 60) {
    return { label: "Fair", text: "text-attention", fill: "bg-attention", color: "var(--attention)" };
  }
  return { label: "Pay attention", text: "text-alert", fill: "bg-alert", color: "var(--alert)" };
}
