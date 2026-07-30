import { describe, expect, it } from "vitest";
import { summarizeWorkoutsByDay } from "./workout-summary";

describe("summarizeWorkoutsByDay", () => {
  it("keeps calories unavailable when a workout omits them", () => {
    const summaries = summarizeWorkoutsByDay([
      {
        day: "2026-07-30",
        activity: "cycling",
        calories: null,
      },
    ]);

    expect(summaries.get("2026-07-30")).toEqual({
      count: 1,
      calories: null,
      types: ["cycling"],
    });
  });

  it("does not present a partial calorie total as complete", () => {
    const summaries = summarizeWorkoutsByDay([
      {
        day: "2026-07-30",
        activity: "running",
        calories: 240,
      },
      {
        day: "2026-07-30",
        activity: "strength_training",
        calories: null,
      },
    ]);

    expect(summaries.get("2026-07-30")?.calories).toBeNull();
  });

  it("sums complete calorie data and preserves an explicit zero", () => {
    const summaries = summarizeWorkoutsByDay([
      {
        day: "2026-07-29",
        activity: "walking",
        calories: 0,
      },
      {
        day: "2026-07-30",
        activity: "running",
        calories: 240,
      },
      {
        day: "2026-07-30",
        activity: "running",
        calories: 160,
      },
    ]);

    expect(summaries.get("2026-07-29")?.calories).toBe(0);
    expect(summaries.get("2026-07-30")?.calories).toBe(400);
    expect(summaries.get("2026-07-30")?.types).toEqual(["running"]);
  });
});
