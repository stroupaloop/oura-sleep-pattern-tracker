import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./config";
import {
  ALERT_SPAN_DAYS,
  concerningNightsInSpan,
  describePersistence,
  LOWER_VIEW_DAYS,
  LOWER_VIEW_MIN_NIGHTS,
} from "./persistence";

function nights(scores: Array<[string, number, number?]>) {
  return scores.map(([day, compositeScore, activation]) => ({
    day,
    compositeScore,
    activation,
  }));
}

describe("concerningNightsInSpan", () => {
  const line = DEFAULT_CONFIG.concernThreshold;

  it("counts concerning nights among the last few, not only an unbroken run", () => {
    const recent = nights([
      ["2026-07-01", line + 1],
      ["2026-07-02", line - 0.2],
      ["2026-07-03", line + 1],
    ]);
    expect(concerningNightsInSpan(recent, line, 3)).toBe(2);
  });

  it("looks back only as far as the span", () => {
    const recent = nights([
      ["2026-07-01", line + 1],
      ["2026-07-02", line + 1],
      ["2026-07-03", line - 0.5],
      ["2026-07-04", line - 0.5],
      ["2026-07-05", line + 1],
    ]);
    expect(concerningNightsInSpan(recent, line, 3)).toBe(1);
    expect(concerningNightsInSpan(recent, line, 5)).toBe(3);
  });

  it("never lets a night with no data count as concerning", () => {
    const recent = nights([
      ["2026-07-01", line + 1],
      ["2026-07-05", line + 1],
    ]);
    expect(concerningNightsInSpan(recent, line, 3)).toBe(1);
    expect(concerningNightsInSpan(recent, line, 5)).toBe(2);
  });

  it("does not count a score exactly on the line", () => {
    expect(concerningNightsInSpan(nights([["2026-07-01", line]]), line, 3)).toBe(0);
  });

  it("is zero with nothing scored", () => {
    expect(concerningNightsInSpan([], line, 3)).toBe(0);
  });

  describe("with a lean", () => {
    const week = nights([
      ["2026-07-01", line + 1, 1.2],
      ["2026-07-02", line + 1, -1.0],
      ["2026-07-03", line + 1, 0.2],
      ["2026-07-04", line + 1, 0.9],
      ["2026-07-05", line - 0.3, 1.4],
      ["2026-07-06", line + 1, 0.8],
    ]);

    it("counts only the concerning nights that lean the same way", () => {
      expect(concerningNightsInSpan(week, line, 6)).toBe(5);
      expect(
        concerningNightsInSpan(week, line, 6, { direction: "hyper", margin: 0.3 })
      ).toBe(3);
      expect(
        concerningNightsInSpan(week, line, 6, { direction: "hypo", margin: 0.3 })
      ).toBe(1);
    });

    it("takes a night scored without a lean at its composite score alone", () => {
      const older = nights([
        ["2026-07-01", line + 1],
        ["2026-07-02", line + 1, -1],
      ]);
      expect(
        concerningNightsInSpan(older, line, 2, { direction: "hyper", margin: 0.3 })
      ).toBe(1);
    });
  });
});

describe("the rules' spans", () => {
  it("lets Alert skip nights within the last seven, and no more than the minimum days asks for", () => {
    expect(ALERT_SPAN_DAYS).toBe(7);
    expect(ALERT_SPAN_DAYS).toBeGreaterThan(DEFAULT_CONFIG.alertMinDays);
  });

  it("asks the two-week view for more of its nights as the tier rises", () => {
    expect(LOWER_VIEW_DAYS).toBe(14);
    expect(LOWER_VIEW_MIN_NIGHTS).toEqual({ watch: 8, warning: 10, alert: 12 });
  });
});

describe("describePersistence", () => {
  it("says how many of the last nights", () => {
    expect(describePersistence({ nights: 5, span: 7 })).toBe("5 of the last 7 nights");
    expect(describePersistence({ nights: 11, span: 14 })).toBe("11 of the last 14 nights");
  });

  it("says each night when none was missed", () => {
    expect(describePersistence({ nights: 3, span: 3 })).toBe("each of the last 3 nights");
  });
});
