import { describe, expect, it } from "vitest";
import {
  aggregateHeartRateSamples,
  getHeartRateQueryRange,
} from "./heartrate";

describe("aggregateHeartRateSamples", () => {
  it("uses the configured local day across a UTC midnight", () => {
    const result = aggregateHeartRateSamples(
      [
        { timestamp: "2026-07-30T03:30:00Z", bpm: 60, source: "rest" },
        { timestamp: "2026-07-30T04:30:00Z", bpm: 70, source: "awake" },
      ],
      "America/New_York"
    );

    expect(result.daily.map((bucket) => bucket.day)).toEqual([
      "2026-07-29",
      "2026-07-30",
    ]);
    expect(result.hourly.map((bucket) => bucket.hour)).toEqual([23, 0]);
  });

  it("keeps all documented sources and marks tied hours as mixed", () => {
    const result = aggregateHeartRateSamples(
      [
        { timestamp: "2026-07-30T12:00:00Z", bpm: 100, source: "workout" },
        { timestamp: "2026-07-30T12:15:00Z", bpm: 80, source: "awake" },
      ],
      "UTC"
    );

    expect(result.hourly[0]).toMatchObject({
      day: "2026-07-30",
      hour: 12,
      avgBpm: 90,
      source: "mixed",
    });
  });

  it("rejects malformed samples instead of silently mis-bucketing them", () => {
    expect(() =>
      aggregateHeartRateSamples(
        [{ timestamp: "not-a-date", bpm: 60, source: "rest" }],
        "UTC"
      )
    ).toThrow("Invalid Oura heart-rate timestamp");
  });
});

describe("getHeartRateQueryRange", () => {
  it("uses explicit UTC boundaries for a local calendar day", () => {
    expect(
      getHeartRateQueryRange(
        "2026-07-30",
        "2026-07-30",
        "America/New_York"
      )
    ).toEqual({
      startDatetime: "2026-07-30T04:00:00.000Z",
      endDatetime: "2026-07-31T03:59:59.000Z",
    });
  });

  it("accounts for a daylight-saving transition", () => {
    expect(
      getHeartRateQueryRange(
        "2026-03-08",
        "2026-03-08",
        "America/New_York"
      )
    ).toEqual({
      startDatetime: "2026-03-08T05:00:00.000Z",
      endDatetime: "2026-03-09T03:59:59.000Z",
    });
  });
});
