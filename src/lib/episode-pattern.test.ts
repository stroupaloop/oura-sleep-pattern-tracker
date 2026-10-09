import { describe, expect, it } from "vitest";
import { isPatternCheckBehind, summarizeEpisodePattern } from "./episode-pattern";

describe("summarizeEpisodePattern", () => {
  it("is null when nothing was flagged inside the window", () => {
    expect(summarizeEpisodePattern([], "2026-09-14")).toBeNull();
    expect(
      summarizeEpisodePattern(
        [
          { day: "2026-09-27", tier: "none", direction: null },
          { day: "2026-09-10", tier: "alert", direction: "hyper" },
        ],
        "2026-09-14"
      )
    ).toBeNull();
  });

  it("reports the strongest tier and counts every flagged day", () => {
    expect(
      summarizeEpisodePattern(
        [
          { day: "2026-09-27", tier: "watch", direction: "hypo" },
          { day: "2026-09-25", tier: "warning", direction: "hyper" },
          { day: "2026-09-20", tier: "watch", direction: "hyper" },
          { day: "2026-09-18", tier: "none", direction: null },
        ],
        "2026-09-14"
      )
    ).toEqual({
      tier: "warning",
      direction: "hyper",
      flaggedDays: 3,
      lastFlaggedDay: "2026-09-27",
      eased: false,
    });
  });

  it("keeps the most recent day's direction on a tie", () => {
    expect(
      summarizeEpisodePattern(
        [
          { day: "2026-09-27", tier: "watch", direction: "hypo" },
          { day: "2026-09-26", tier: "watch", direction: "hyper" },
        ],
        "2026-09-14"
      )
    ).toMatchObject({ tier: "watch", direction: "hypo", flaggedDays: 2 });
  });

  it("notes when it was last flagged and that clear nights have followed", () => {
    expect(
      summarizeEpisodePattern(
        [
          { day: "2026-09-30", tier: "none", direction: null },
          { day: "2026-09-29", tier: "none", direction: null },
          { day: "2026-09-25", tier: "alert", direction: "hypo" },
          { day: "2026-09-24", tier: "warning", direction: "hypo" },
        ],
        "2026-09-14"
      )
    ).toEqual({
      tier: "alert",
      direction: "hypo",
      flaggedDays: 2,
      lastFlaggedDay: "2026-09-25",
      eased: true,
    });
  });

  it("is not eased while the newest night is still flagged", () => {
    expect(
      summarizeEpisodePattern(
        [
          { day: "2026-09-30", tier: "watch", direction: "hypo" },
          { day: "2026-09-29", tier: "none", direction: null },
          { day: "2026-09-25", tier: "alert", direction: "hypo" },
        ],
        "2026-09-14"
      )
    ).toMatchObject({ lastFlaggedDay: "2026-09-30", eased: false });
  });

  it("reads the newest night whatever order the assessments arrive in", () => {
    expect(
      summarizeEpisodePattern(
        [
          { day: "2026-09-25", tier: "warning", direction: "hyper" },
          { day: "2026-09-30", tier: "none", direction: null },
          { day: "2026-09-27", tier: "watch", direction: "hyper" },
        ],
        "2026-09-14"
      )
    ).toMatchObject({ lastFlaggedDay: "2026-09-27", eased: true });
  });

  it("ignores flags older than the window when saying when it was last flagged", () => {
    expect(
      summarizeEpisodePattern(
        [
          { day: "2026-09-30", tier: "none", direction: null },
          { day: "2026-09-16", tier: "watch", direction: "hyper" },
          { day: "2026-09-10", tier: "alert", direction: "hyper" },
        ],
        "2026-09-14"
      )
    ).toEqual({
      tier: "watch",
      direction: "hyper",
      flaggedDays: 1,
      lastFlaggedDay: "2026-09-16",
      eased: true,
    });
  });
});

describe("isPatternCheckBehind", () => {
  it("accepts a check through last night's data or through the night before", () => {
    expect(isPatternCheckBehind("2026-10-07", "2026-10-07")).toBe(false);
    expect(isPatternCheckBehind("2026-10-06", "2026-10-07")).toBe(false);
  });

  it("is behind once the check is two or more nights old", () => {
    expect(isPatternCheckBehind("2026-10-05", "2026-10-07")).toBe(true);
    expect(isPatternCheckBehind("2026-09-13", "2026-10-07")).toBe(true);
  });

  it("counts nights across month and year ends", () => {
    expect(isPatternCheckBehind("2026-10-31", "2026-11-01")).toBe(false);
    expect(isPatternCheckBehind("2026-10-30", "2026-11-01")).toBe(true);
    expect(isPatternCheckBehind("2026-12-31", "2027-01-01")).toBe(false);
    expect(isPatternCheckBehind("2026-12-30", "2027-01-01")).toBe(true);
    expect(isPatternCheckBehind("2027-02-28", "2027-03-01")).toBe(false);
    expect(isPatternCheckBehind("2027-02-27", "2027-03-01")).toBe(true);
    expect(isPatternCheckBehind("2028-02-29", "2028-03-01")).toBe(false);
    expect(isPatternCheckBehind("2028-02-28", "2028-03-01")).toBe(true);
  });

  it("has nothing to be behind when no check is on record or the day is unreadable", () => {
    expect(isPatternCheckBehind(null, "2026-10-07")).toBe(false);
    expect(isPatternCheckBehind("2026-09-01", "not a day")).toBe(false);
  });
});
