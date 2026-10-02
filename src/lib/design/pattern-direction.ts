/**
 * A pattern's direction, in words and an arrow; never a color, which belongs
 * to the tier beside it.
 */
export interface PatternDirection {
  label: string;
  short: string;
  /** For "… personal-baseline pattern". */
  adjective: string;
  arrow: "up" | "down" | null;
}

export function describePatternDirection(
  direction: string | null | undefined
): PatternDirection {
  if (direction === "hyper") {
    return {
      label: "Higher activation",
      short: "Higher",
      adjective: "Higher-activation",
      arrow: "up",
    };
  }
  if (direction === "hypo") {
    return {
      label: "Lower activation",
      short: "Lower",
      adjective: "Lower-activation",
      arrow: "down",
    };
  }
  return { label: "Mixed", short: "Mixed", adjective: "Mixed", arrow: null };
}
