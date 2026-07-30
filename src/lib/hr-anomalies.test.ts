import { describe, expect, it } from "vitest";
import {
  areAdjacentLocalHours,
  detectHrAnomalies,
  type HourlyHrPoint,
} from "./hr-anomalies";

function point(
  day: string,
  hour: number,
  avgBpm: number,
  source = "rest"
): HourlyHrPoint {
  return {
    day,
    hour,
    avgBpm,
    minBpm: avgBpm,
    maxBpm: avgBpm,
    source,
  };
}

function baseline(hours: number[]): HourlyHrPoint[] {
  return ["2026-01-01", "2026-01-02", "2026-01-03"].flatMap(
    (day, dayIndex) =>
      hours.map((hour) => point(day, hour, 59 + dayIndex, "awake"))
  );
}

describe("areAdjacentLocalHours", () => {
  it("recognizes adjacent hours within a day and across midnight", () => {
    expect(
      areAdjacentLocalHours(
        { day: "2026-01-09", hour: 22 },
        { day: "2026-01-09", hour: 23 }
      )
    ).toBe(true);
    expect(
      areAdjacentLocalHours(
        { day: "2026-01-09", hour: 23 },
        { day: "2026-01-10", hour: 0 }
      )
    ).toBe(true);
  });

  it("rejects gaps and nonconsecutive dates", () => {
    expect(
      areAdjacentLocalHours(
        { day: "2026-01-09", hour: 1 },
        { day: "2026-01-09", hour: 3 }
      )
    ).toBe(false);
    expect(
      areAdjacentLocalHours(
        { day: "2026-01-08", hour: 23 },
        { day: "2026-01-10", hour: 0 }
      )
    ).toBe(false);
  });
});

describe("detectHrAnomalies elevated resting streaks", () => {
  it("detects three adjacent elevated rest hours", () => {
    const anomalies = detectHrAnomalies("2026-01-10", [
      ...baseline([1, 2, 3]),
      point("2026-01-10", 1, 70),
      point("2026-01-10", 2, 70),
      point("2026-01-10", 3, 70),
    ]);

    expect(
      anomalies.find((anomaly) => anomaly.type === "elevated_resting")
    ).toMatchObject({ day: "2026-01-10", hour: 3 });
  });

  it("does not join elevated samples across a missing hour", () => {
    const anomalies = detectHrAnomalies("2026-01-10", [
      ...baseline([1, 3, 4]),
      point("2026-01-10", 1, 70),
      point("2026-01-10", 3, 70),
      point("2026-01-10", 4, 70),
    ]);

    expect(
      anomalies.some((anomaly) => anomaly.type === "elevated_resting")
    ).toBe(false);
  });

  it("continues an adjacent streak across local midnight", () => {
    const anomalies = detectHrAnomalies("2026-01-10", [
      ...baseline([22, 23, 0]),
      point("2026-01-09", 22, 70),
      point("2026-01-09", 23, 70),
      point("2026-01-10", 0, 70),
    ]);

    expect(
      anomalies.find((anomaly) => anomaly.type === "elevated_resting")
    ).toMatchObject({ day: "2026-01-10", hour: 0 });
  });
});
