import { describe, expect, it } from "vitest";
import {
  MAX_GRID_WEEKS,
  MIN_GRID_WEEKS,
  bucketForCount,
  buildGrid,
  countSince,
  currentStreak,
  formatCompactAgo,
  gridWeekCount,
  noteSizeBucket,
} from "./thoughts-stats";

describe("bucketForCount", () => {
  it("maps counts onto the five ramp steps", () => {
    expect(bucketForCount(0)).toBe(0);
    expect(bucketForCount(1)).toBe(1);
    expect(bucketForCount(2)).toBe(2);
    expect(bucketForCount(3)).toBe(2);
    expect(bucketForCount(4)).toBe(3);
    expect(bucketForCount(6)).toBe(3);
    expect(bucketForCount(7)).toBe(4);
    expect(bucketForCount(99)).toBe(4);
  });

  it("treats negative and non-finite counts as empty", () => {
    expect(bucketForCount(-2)).toBe(0);
    expect(bucketForCount(Number.NaN)).toBe(0);
  });
});

describe("gridWeekCount", () => {
  it("falls back to the minimum with no history", () => {
    expect(gridWeekCount(null, "2026-09-25")).toBe(MIN_GRID_WEEKS);
  });

  it("does not render a near-empty year for a young dataset", () => {
    expect(gridWeekCount("2026-09-20", "2026-09-25")).toBe(MIN_GRID_WEEKS);
  });

  it("grows with history", () => {
    expect(gridWeekCount("2026-01-01", "2026-09-25")).toBeGreaterThan(
      MIN_GRID_WEEKS
    );
  });

  it("caps at a year", () => {
    expect(gridWeekCount("2019-01-01", "2026-09-25")).toBe(MAX_GRID_WEEKS);
  });
});

describe("buildGrid", () => {
  it("produces whole Sunday-first weeks ending on a Saturday", () => {
    const grid = buildGrid({}, "2026-09-25", null);
    expect(grid.weeks).toHaveLength(MIN_GRID_WEEKS);
    for (const week of grid.weeks) {
      expect(week.days).toHaveLength(7);
    }
    // 2026-09-25 is a Friday, so the grid ends the next day.
    expect(grid.endDay).toBe("2026-09-26");
    expect(new Date(`${grid.startDay}T12:00:00Z`).getUTCDay()).toBe(0);
  });

  it("marks days after today as future", () => {
    const grid = buildGrid({}, "2026-09-25", null);
    const all = grid.weeks.flatMap((week) => week.days);
    expect(all.find((cell) => cell?.day === "2026-09-25")?.future).toBe(false);
    expect(all.find((cell) => cell?.day === "2026-09-26")?.future).toBe(true);
  });

  it("carries counts and buckets onto the right day", () => {
    const grid = buildGrid({ "2026-09-24": 5 }, "2026-09-25", "2026-09-01");
    const cell = grid.weeks
      .flatMap((week) => week.days)
      .find((entry) => entry?.day === "2026-09-24");
    expect(cell?.count).toBe(5);
    expect(cell?.bucket).toBe(3);
  });
});

describe("currentStreak", () => {
  it("counts consecutive days back from today", () => {
    const counts = {
      "2026-09-25": 2,
      "2026-09-24": 1,
      "2026-09-23": 3,
    };
    expect(currentStreak(counts, "2026-09-25")).toBe(3);
  });

  it("does not reset just because today has nothing logged yet", () => {
    const counts = { "2026-09-24": 1, "2026-09-23": 1 };
    expect(currentStreak(counts, "2026-09-25")).toBe(2);
  });

  it("is zero when neither today nor yesterday has anything", () => {
    expect(currentStreak({ "2026-09-20": 4 }, "2026-09-25")).toBe(0);
  });

  it("stops at the first gap", () => {
    const counts = {
      "2026-09-25": 1,
      "2026-09-24": 1,
      "2026-09-22": 9,
    };
    expect(currentStreak(counts, "2026-09-25")).toBe(2);
  });
});

describe("countSince", () => {
  it("sums an inclusive trailing window", () => {
    const counts = {
      "2026-09-25": 1,
      "2026-09-24": 2,
      "2026-09-19": 100,
    };
    expect(countSince(counts, "2026-09-25", 7)).toBe(103);
    expect(countSince(counts, "2026-09-25", 2)).toBe(3);
  });
});

describe("formatCompactAgo", () => {
  const now = 1_800_000_000;

  it("returns null with no timestamp", () => {
    expect(formatCompactAgo(null, now)).toBeNull();
  });

  it("collapses the last minute and a half to 'just now'", () => {
    expect(formatCompactAgo(now - 10, now)).toBe("just now");
    expect(formatCompactAgo(now - 89, now)).toBe("just now");
  });

  it("steps up through minutes, hours, days, months, years", () => {
    expect(formatCompactAgo(now - 15 * 60, now)).toBe("15m ago");
    expect(formatCompactAgo(now - 5 * 3600, now)).toBe("5h ago");
    expect(formatCompactAgo(now - 3 * 86400, now)).toBe("3d ago");
    expect(formatCompactAgo(now - 90 * 86400, now)).toBe("3mo ago");
    expect(formatCompactAgo(now - 400 * 86400, now)).toBe("1y ago");
  });

  it("never reports a negative age for a clock skew", () => {
    expect(formatCompactAgo(now + 600, now)).toBe("just now");
  });
});

describe("noteSizeBucket", () => {
  it("buckets by coarse length", () => {
    expect(noteSizeBucket(0)).toBe("short");
    expect(noteSizeBucket(60)).toBe("short");
    expect(noteSizeBucket(61)).toBe("medium");
    expect(noteSizeBucket(200)).toBe("medium");
    expect(noteSizeBucket(201)).toBe("long");
  });

  it("treats a link-only entry as short", () => {
    expect(noteSizeBucket(0)).toBe("short");
  });

  it("is safe on non-finite input", () => {
    expect(noteSizeBucket(Number.NaN)).toBe("short");
  });
});
