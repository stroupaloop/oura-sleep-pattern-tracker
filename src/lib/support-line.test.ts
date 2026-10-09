import { describe, expect, it } from "vitest";
import {
  moodNeedsSupportLine,
  patternNeedsSupportLine,
  SUPPORT_LINE,
} from "./support-line";

describe("moodNeedsSupportLine", () => {
  it("shows for low and very low moods only", () => {
    expect(moodNeedsSupportLine(-3)).toBe(true);
    expect(moodNeedsSupportLine(-2)).toBe(true);
    expect(moodNeedsSupportLine(-1)).toBe(false);
    expect(moodNeedsSupportLine(0)).toBe(false);
    expect(moodNeedsSupportLine(3)).toBe(false);
  });

  it("stays quiet when nothing is logged", () => {
    expect(moodNeedsSupportLine(null)).toBe(false);
    expect(moodNeedsSupportLine(undefined)).toBe(false);
  });
});

describe("patternNeedsSupportLine", () => {
  it("shows for a flagged lower-activation or mixed pattern", () => {
    expect(
      patternNeedsSupportLine([{ tier: "watch", direction: "hypo" }])
    ).toBe(true);
    expect(
      patternNeedsSupportLine([{ tier: "warning", direction: null }])
    ).toBe(true);
  });

  it("does not show for a higher-activation pattern or an unflagged day", () => {
    expect(
      patternNeedsSupportLine([{ tier: "alert", direction: "hyper" }])
    ).toBe(false);
    expect(
      patternNeedsSupportLine([{ tier: "none", direction: "hypo" }])
    ).toBe(false);
    expect(patternNeedsSupportLine([])).toBe(false);
  });

  it("shows if any one of several flagged days is lower or mixed", () => {
    expect(
      patternNeedsSupportLine([
        { tier: "alert", direction: "hyper" },
        { tier: "watch", direction: "hypo" },
      ])
    ).toBe(true);
  });
});

describe("SUPPORT_LINE", () => {
  it("points at 988 for calls, texts and chat", () => {
    expect(SUPPORT_LINE.callHref).toBe("tel:988");
    expect(SUPPORT_LINE.textHref).toBe("sms:988");
    expect(SUPPORT_LINE.chatHref).toMatch(/^https:\/\/988lifeline\.org\//);
  });
});
