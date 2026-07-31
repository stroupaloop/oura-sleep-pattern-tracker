import { describe, expect, it } from "vitest";
import {
  projectActivityToCalendarDays,
  type StoredOuraActivityClassification,
} from "./activity";

function activity(
  day: string,
  timestamp: string,
  class5min: string
): StoredOuraActivityClassification {
  return {
    day,
    class5min,
    met: JSON.stringify({ timestamp, interval: 60, items: [] }),
  };
}

describe("projectActivityToCalendarDays", () => {
  it("combines adjacent 4 a.m. Oura activity days into ET calendar days", () => {
    const result = projectActivityToCalendarDays(
      [
        activity(
          "2026-07-29",
          "2026-07-29T04:00:00-04:00",
          "1".repeat(288)
        ),
        activity(
          "2026-07-30",
          "2026-07-30T04:00:00-04:00",
          "3".repeat(288)
        ),
      ],
      "America/New_York"
    );

    const july30 = result.find((day) => day.day === "2026-07-30");
    expect(july30).toMatchObject({
      classifiedMinutes: 1440,
      restingMinutes: 240,
      lowActivityMinutes: 1200,
      nonWearMinutes: 0,
    });
    expect(july30?.hours[3].dominantCode).toBe(1);
    expect(july30?.hours[4].dominantCode).toBe(3);
  });

  it("accepts a partial current day without turning missing hours into non-wear", () => {
    const [day] = projectActivityToCalendarDays(
      [activity("2026-07-30", "2026-07-30T04:00:00-04:00", "2".repeat(36))],
      "America/New_York"
    );

    expect(day.classifiedMinutes).toBe(180);
    expect(day.nonWearMinutes).toBe(0);
    expect(day.hours[4].dominantCode).toBe(2);
    expect(day.hours[7].dominantCode).toBeNull();
    expect(day.hours[7].classifiedMinutes).toBe(0);
  });

  it("uses only explicit zero codes as non-wear", () => {
    const [day] = projectActivityToCalendarDays(
      [
        activity(
          "2026-07-30",
          "2026-07-30T04:00:00-04:00",
          `${"0".repeat(7)}${"3".repeat(5)}`
        ),
      ],
      "America/New_York"
    );

    expect(day.nonWearMinutes).toBe(35);
    expect(day.hours[4]).toMatchObject({
      dominantCode: 0,
      classifiedMinutes: 60,
      nonWearMinutes: 35,
    });
    expect(day.hours[5].dominantCode).toBeNull();
  });

  it("translates a non-ET source offset into ET", () => {
    const result = projectActivityToCalendarDays(
      [activity("2026-07-30", "2026-07-30T04:00:00-07:00", "4".repeat(12))],
      "America/New_York"
    );

    const july30 = result.find((day) => day.day === "2026-07-30");
    expect(july30?.hours[7]).toMatchObject({
      dominantCode: 4,
      classifiedMinutes: 60,
    });
    expect(july30?.hours[4].classifiedMinutes).toBe(0);
  });

  it("prefers the Daily Activity timestamp retained during newer syncs", () => {
    const [day] = projectActivityToCalendarDays(
      [
        {
          day: "2026-07-30",
          class5min: "4".repeat(12),
          met: JSON.stringify({
            activity_timestamp: "2026-07-30T04:00:00-04:00",
            timestamp: "2026-07-30T04:00:00-07:00",
          }),
        },
      ],
      "America/New_York"
    );

    expect(day.hours[4].dominantCode).toBe(4);
    expect(day.hours[7].classifiedMinutes).toBe(0);
  });

  it("leaves missing adjacent activity periods unavailable", () => {
    const currentOnly = projectActivityToCalendarDays(
      [
        activity(
          "2026-07-30",
          "2026-07-30T04:00:00-04:00",
          "3".repeat(288)
        ),
      ],
      "America/New_York"
    ).find((day) => day.day === "2026-07-30");
    expect(currentOnly?.hours[3]).toMatchObject({
      dominantCode: null,
      classifiedMinutes: 0,
      nonWearMinutes: 0,
    });

    const previousOnly = projectActivityToCalendarDays(
      [
        activity(
          "2026-07-29",
          "2026-07-29T04:00:00-04:00",
          "3".repeat(288)
        ),
      ],
      "America/New_York"
    ).find((day) => day.day === "2026-07-30");
    expect(previousOnly?.hours[4]).toMatchObject({
      dominantCode: null,
      classifiedMinutes: 0,
      nonWearMinutes: 0,
    });
  });

  it("maps complete 23-hour and 25-hour ET days across DST", () => {
    const spring = projectActivityToCalendarDays(
      [
        activity(
          "2026-03-07",
          "2026-03-07T04:00:00-05:00",
          "1".repeat(276)
        ),
        activity(
          "2026-03-08",
          "2026-03-08T04:00:00-04:00",
          "1".repeat(288)
        ),
      ],
      "America/New_York"
    );
    const springDay = spring.find((day) => day.day === "2026-03-08");
    expect(springDay?.classifiedMinutes).toBe(1380);
    expect(springDay?.hours[2].classifiedMinutes).toBe(0);

    const fall = projectActivityToCalendarDays(
      [
        activity(
          "2026-10-31",
          "2026-10-31T04:00:00-04:00",
          "1".repeat(300)
        ),
        activity(
          "2026-11-01",
          "2026-11-01T04:00:00-05:00",
          "1".repeat(288)
        ),
      ],
      "America/New_York"
    );
    const fallDay = fall.find((day) => day.day === "2026-11-01");
    expect(fallDay?.classifiedMinutes).toBe(1500);
    expect(fallDay?.hours[1].classifiedMinutes).toBe(120);
  });

  it("deduplicates overlapping instants in favor of the later activity period", () => {
    const result = projectActivityToCalendarDays(
      [
        activity(
          "2026-03-07",
          "2026-03-07T04:00:00-05:00",
          "1".repeat(288)
        ),
        activity(
          "2026-03-08",
          "2026-03-08T04:00:00-04:00",
          "5".repeat(12)
        ),
      ],
      "America/New_York"
    );
    const springDay = result.find((day) => day.day === "2026-03-08");

    expect(springDay?.hours[4]).toMatchObject({
      dominantCode: 5,
      classifiedMinutes: 60,
    });
  });

  it("leaves malformed or timezone-free records unavailable", () => {
    expect(
      projectActivityToCalendarDays(
        [
          activity("2026-07-30", "2026-07-30T04:00:00", "1".repeat(12)),
          {
            day: "2026-07-31",
            class5min: "123x",
            met: JSON.stringify({
              timestamp: "2026-07-31T04:00:00-04:00",
            }),
          },
          {
            day: "2026-08-01",
            class5min: "1".repeat(12),
            met: "not-json",
          },
        ],
        "America/New_York"
      )
    ).toEqual([]);
  });
});
