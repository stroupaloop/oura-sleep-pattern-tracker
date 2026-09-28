import { describe, expect, it } from "vitest";
import { summarizeEpisodePattern } from "./episode-pattern";

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
    ).toEqual({ tier: "warning", direction: "hyper", flaggedDays: 3 });
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
    ).toEqual({ tier: "watch", direction: "hypo", flaggedDays: 2 });
  });
});
