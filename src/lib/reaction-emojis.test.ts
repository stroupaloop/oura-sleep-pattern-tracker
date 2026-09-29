import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECENT_REACTIONS,
  REACTION_EMOJIS,
  isAllowedReaction,
  rankRecentReactions,
} from "./reaction-emojis";

describe("isAllowedReaction", () => {
  it("accepts only the offered emojis", () => {
    expect(isAllowedReaction("❤️")).toBe(true);
    expect(isAllowedReaction("🌙")).toBe(true);
    expect(isAllowedReaction("❤")).toBe(false);
    expect(isAllowedReaction("<script>")).toBe(false);
    expect(isAllowedReaction(1)).toBe(false);
  });

  it("offers each emoji once", () => {
    expect(new Set(REACTION_EMOJIS).size).toBe(REACTION_EMOJIS.length);
  });
});

describe("rankRecentReactions", () => {
  it("starts from the defaults with no history", () => {
    expect(rankRecentReactions([])).toEqual(DEFAULT_RECENT_REACTIONS);
  });

  it("puts the most used first, breaks ties by recency, and fills from the defaults", () => {
    expect(
      rankRecentReactions([
        { emoji: "🔥", uses: 1, lastUsedAt: 300 },
        { emoji: "🥹", uses: 4, lastUsedAt: 100 },
        { emoji: "🌙", uses: 1, lastUsedAt: 500 },
        { emoji: "❤️", uses: 2, lastUsedAt: 200 },
      ])
    ).toEqual(["🥹", "❤️", "🌙", "🔥", "🥰"]);
  });

  it("drops anything no longer offered and never repeats an emoji", () => {
    const recents = rankRecentReactions([
      { emoji: "🦄", uses: 9, lastUsedAt: 900 },
      { emoji: "🥰", uses: 3, lastUsedAt: 100 },
    ]);
    expect(recents).not.toContain("🦄");
    expect(recents[0]).toBe("🥰");
    expect(new Set(recents).size).toBe(recents.length);
    expect(recents).toHaveLength(5);
  });
});
