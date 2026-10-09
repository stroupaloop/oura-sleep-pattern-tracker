import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/thoughts-schedule";
import {
  areAdjacentLocalHours,
  detectHrAnomalies,
  HR_ANOMALY_BASELINE_DAYS,
  HR_ANOMALY_MIN_BASELINE_DAYS,
  HR_ANOMALY_MIN_RUN_HOURS,
  HR_ANOMALY_MIN_SD_BPM,
  HR_ANOMALY_Z_THRESHOLD,
  type HourlyHrPoint,
} from "./hr-anomalies";

function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

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

/**
 * `count` days from `firstDay` with the given hours, alternating between
 * `low` and `high` so the same-hour average is their midpoint.
 */
function history(
  firstDay: string,
  count: number,
  hours: number[],
  { low = 58, high = 62, source = "awake" } = {}
): HourlyHrPoint[] {
  return Array.from({ length: count }, (_, index) =>
    hours.map((hour) =>
      point(
        shiftDay(firstDay, index),
        hour,
        index % 2 === 0 ? low : high,
        source
      )
    )
  ).flat();
}

const SELECTED = "2026-03-20";
const NIGHT_HOURS = [0, 1, 2, 3, 4, 5, 6];

function priorDays(
  hours: number[],
  count: number,
  options?: Parameters<typeof history>[3]
): HourlyHrPoint[] {
  return history(shiftDay(SELECTED, -count), count, hours, options);
}

// An even number of days alternating 58 and 62 average 60, and their sample
// variance is days * 4 / (days - 1).
function sampleSd(days: number): number {
  return Math.sqrt((days * 4) / (days - 1));
}

function limitAbove(days: number): number {
  return (
    60 + HR_ANOMALY_Z_THRESHOLD * sampleSd(days) * Math.sqrt(1 + 1 / days)
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

describe("detectHrAnomalies overnight runs", () => {
  const fortnight = priorDays(NIGHT_HOURS, 14);

  it("marks two or more adjacent overnight hours well above the same hour", () => {
    const anomalies = detectHrAnomalies(SELECTED, [
      ...fortnight,
      point(SELECTED, 2, 68),
      point(SELECTED, 3, 69),
    ]);

    expect(anomalies).toMatchObject([
      { day: SELECTED, hour: 2, type: "spike", baseline: 60 },
      { day: SELECTED, hour: 3, type: "spike", baseline: 60 },
    ]);
  });

  it("marks a run of low hours as a drop", () => {
    const anomalies = detectHrAnomalies(SELECTED, [
      ...fortnight,
      point(SELECTED, 4, 52),
      point(SELECTED, 5, 51),
    ]);

    expect(anomalies.map((anomaly) => [anomaly.hour, anomaly.type])).toEqual([
      [4, "drop"],
      [5, "drop"],
    ]);
  });

  it("does not mark one odd hour on its own", () => {
    expect(HR_ANOMALY_MIN_RUN_HOURS).toBeGreaterThan(1);
    expect(
      detectHrAnomalies(SELECTED, [
        ...fortnight,
        point(SELECTED, 2, 70),
        point(SELECTED, 3, 60),
      ])
    ).toEqual([]);
  });

  it("does not join odd hours across a normal hour or a missing one", () => {
    expect(
      detectHrAnomalies(SELECTED, [
        ...fortnight,
        point(SELECTED, 1, 70),
        point(SELECTED, 2, 60),
        point(SELECTED, 3, 70),
      ])
    ).toEqual([]);
    expect(
      detectHrAnomalies(SELECTED, [
        ...fortnight,
        point(SELECTED, 1, 70),
        point(SELECTED, 3, 70),
      ])
    ).toEqual([]);
  });

  it("does not join a spike with a drop, and keeps each direction's own run", () => {
    expect(
      detectHrAnomalies(SELECTED, [
        ...fortnight,
        point(SELECTED, 2, 70),
        point(SELECTED, 3, 50),
      ])
    ).toEqual([]);

    const anomalies = detectHrAnomalies(SELECTED, [
      ...fortnight,
      point(SELECTED, 1, 70),
      point(SELECTED, 2, 71),
      point(SELECTED, 3, 50),
      point(SELECTED, 4, 49),
    ]);
    expect(anomalies.map((anomaly) => [anomaly.hour, anomaly.type])).toEqual([
      [1, "spike"],
      [2, "spike"],
      [3, "drop"],
      [4, "drop"],
    ]);
  });

  it("does not judge daytime hours, which swing with activity", () => {
    const daytime = [12, 13, 14];
    expect(
      detectHrAnomalies(SELECTED, [
        ...priorDays(daytime, 14),
        point(SELECTED, 12, 95, "awake"),
        point(SELECTED, 13, 96, "awake"),
        point(SELECTED, 14, 97, "awake"),
      ])
    ).toEqual([]);
  });

  it("judges an hour only once it has enough prior days", () => {
    const today = [point(SELECTED, 2, 70), point(SELECTED, 3, 70)];

    expect(
      detectHrAnomalies(SELECTED, [
        ...priorDays([2, 3], HR_ANOMALY_MIN_BASELINE_DAYS - 1),
        ...today,
      ])
    ).toEqual([]);
    expect(
      detectHrAnomalies(SELECTED, [
        ...priorDays([2, 3], HR_ANOMALY_MIN_BASELINE_DAYS),
        ...today,
      ]).map((anomaly) => anomaly.hour)
    ).toEqual([2, 3]);
  });

  it("flags an hour just past the threshold and not one just inside it", () => {
    const limit = limitAbove(14);

    expect(
      detectHrAnomalies(SELECTED, [
        ...fortnight,
        point(SELECTED, 2, limit + 0.2),
        point(SELECTED, 3, limit + 0.2),
      ]).map((anomaly) => anomaly.hour)
    ).toEqual([2, 3]);
    expect(
      detectHrAnomalies(SELECTED, [
        ...fortnight,
        point(SELECTED, 2, limit - 0.2),
        point(SELECTED, 3, limit - 0.2),
      ])
    ).toEqual([]);
  });

  it("never takes her usual spread as less than the floor", () => {
    const flat = priorDays(NIGHT_HOURS, 14, { low: 60, high: 60 });
    const limit =
      60 + HR_ANOMALY_Z_THRESHOLD * HR_ANOMALY_MIN_SD_BPM * Math.sqrt(1 + 1 / 14);

    expect(
      detectHrAnomalies(SELECTED, [
        ...flat,
        point(SELECTED, 2, limit - 0.2),
        point(SELECTED, 3, limit - 0.2),
      ])
    ).toEqual([]);
    expect(
      detectHrAnomalies(SELECTED, [
        ...flat,
        point(SELECTED, 2, limit + 0.2),
        point(SELECTED, 3, limit + 0.2),
      ]).map((anomaly) => anomaly.hour)
    ).toEqual([2, 3]);
  });

  it("allows for a short baseline being only a sample of her nights", () => {
    const days = 10;
    const baseline = priorDays(NIGHT_HOURS, days);
    const limit = limitAbove(days);
    const withoutAllowance = 60 + HR_ANOMALY_Z_THRESHOLD * sampleSd(days);
    const between = (limit + withoutAllowance) / 2;

    expect(limit).toBeGreaterThan(withoutAllowance);
    expect(
      detectHrAnomalies(SELECTED, [
        ...baseline,
        point(SELECTED, 2, between),
        point(SELECTED, 3, between),
      ])
    ).toEqual([]);
    expect(
      detectHrAnomalies(SELECTED, [
        ...baseline,
        point(SELECTED, 2, limit + 0.2),
        point(SELECTED, 3, limit + 0.2),
      ]).map((anomaly) => anomaly.hour)
    ).toEqual([2, 3]);
  });

  it("compares an hour with the two weeks before, not older history", () => {
    const selected = shiftDay(SELECTED, 30);
    const recentStart = shiftDay(selected, -HR_ANOMALY_BASELINE_DAYS);
    // Before that window the same hours ran higher.
    const older = history(shiftDay(recentStart, -6), 6, [2, 3], {
      low: 70,
      high: 70,
    });
    const recent = history(recentStart, HR_ANOMALY_BASELINE_DAYS, [2, 3], {
      low: 59,
      high: 61,
    });

    const anomalies = detectHrAnomalies(selected, [
      ...older,
      ...recent,
      point(selected, 2, 67, "awake"),
      point(selected, 3, 67, "awake"),
    ]);

    expect(anomalies).toMatchObject([
      { day: selected, hour: 2, type: "spike", baseline: 60 },
      { day: selected, hour: 3, type: "spike", baseline: 60 },
    ]);
  });
});

describe("detectHrAnomalies elevated resting streaks", () => {
  const baseline = (hours: number[]) =>
    history("2026-01-01", 8, hours, { low: 59, high: 61 });

  it("detects three adjacent elevated rest hours", () => {
    const anomalies = detectHrAnomalies("2026-01-10", [
      ...baseline([13, 14, 15]),
      point("2026-01-10", 13, 70),
      point("2026-01-10", 14, 70),
      point("2026-01-10", 15, 70),
    ]);

    expect(
      anomalies.find((anomaly) => anomaly.type === "elevated_resting")
    ).toMatchObject({ day: "2026-01-10", hour: 15 });
  });

  it("does not join elevated samples across a missing hour", () => {
    const anomalies = detectHrAnomalies("2026-01-10", [
      ...baseline([13, 15, 16]),
      point("2026-01-10", 13, 70),
      point("2026-01-10", 15, 70),
      point("2026-01-10", 16, 70),
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

  it("needs a week of same-hour history before it counts anything", () => {
    const today = [13, 14, 15].map((hour) => point("2026-01-10", hour, 70));
    const short = history("2026-01-03", 6, [13, 14, 15], {
      low: 59,
      high: 61,
    });

    expect(
      detectHrAnomalies("2026-01-10", [...short, ...today]).some(
        (anomaly) => anomaly.type === "elevated_resting"
      )
    ).toBe(false);
  });
});

const FIRST_DAY = "2026-06-01";

function gaussian(random: () => number): number {
  let u = 0;
  while (u === 0) u = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

interface Simulation {
  days: number;
  seed: number;
  /** Which hours Oura's `rest` label lands on: the night, or sedentary daytime. */
  restIsNight: boolean;
  /** Adds bpm to `hours` hours from `fromHour` on one day. */
  elevation?: { dayIndex: number; fromHour: number; hours: number; bpm: number };
}

/**
 * A steady synthetic person: a sleeping dip, a morning rise, daytime and
 * evening activity bursts, and a slow day-to-day drift shared by every hour.
 * Nothing about her changes over the run.
 */
function simulate({
  days,
  seed,
  restIsNight,
  elevation,
}: Simulation): HourlyHrPoint[] {
  const random = mulberry32(seed);
  const points: HourlyHrPoint[] = [];
  let drift = 0;
  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    drift = 0.5 * drift + Math.sqrt(0.75) * gaussian(random);
    const dayOffset = 1.5 * drift;
    for (let hour = 0; hour < 24; hour++) {
      let bpm: number;
      let burst = false;
      if (hour <= 6) bpm = 54 + 2 * gaussian(random);
      else if (hour <= 8) bpm = 64 + 5 * gaussian(random);
      else if (hour <= 17) {
        burst = random() < 0.15;
        bpm = burst ? 100 + 15 * gaussian(random) : 74 + 6 * gaussian(random);
      } else if (hour <= 21) {
        burst = random() < 0.1;
        bpm = burst ? 92 + 12 * gaussian(random) : 70 + 6 * gaussian(random);
      } else bpm = 62 + 4 * gaussian(random);
      bpm += dayOffset;
      if (
        elevation &&
        elevation.dayIndex === dayIndex &&
        hour >= elevation.fromHour &&
        hour < elevation.fromHour + elevation.hours
      ) {
        bpm += elevation.bpm;
      }
      const night = hour <= 8 || hour >= 22;
      let source = "awake";
      if (restIsNight) {
        if (night) source = "rest";
      } else if (hour <= 6) {
        source = "sleep";
      } else if (!night && !burst) {
        source = "rest";
      }
      points.push(point(shiftDay(FIRST_DAY, dayIndex), hour, Math.round(bpm * 10) / 10, source));
    }
  }
  return points;
}

describe("detectHrAnomalies on synthetic steady days", () => {
  // The old rule marked about two hours a day on data like this.
  const SCORED_FROM = HR_ANOMALY_BASELINE_DAYS + 6;
  const DAYS = 140;

  it.each([
    ["rest labels the night", true],
    ["rest labels sedentary daytime", false],
  ])("raises at most 0.2 markers a day when %s", (_label, restIsNight) => {
    let markers = 0;
    let spikesAndDrops = 0;
    let scored = 0;
    for (const seed of [11, 12, 13, 14, 15]) {
      const data = simulate({ days: DAYS, seed, restIsNight });
      for (let dayIndex = SCORED_FROM; dayIndex < DAYS; dayIndex++) {
        const anomalies = detectHrAnomalies(shiftDay(FIRST_DAY, dayIndex), data);
        markers += anomalies.length;
        spikesAndDrops += anomalies.filter(
          (anomaly) => anomaly.type !== "elevated_resting"
        ).length;
        scored++;
      }
    }

    expect(markers / scored).toBeLessThanOrEqual(0.2);
    expect(spikesAndDrops / scored).toBeLessThanOrEqual(0.05);
  });

  it("still finds a 10 bpm rise across four night hours at least 90% of the time", () => {
    let found = 0;
    let trials = 0;
    for (const seed of [41, 42, 43, 44, 45, 46]) {
      for (const dayIndex of [40, 55, 70, 85, 100]) {
        const data = simulate({
          days: 120,
          seed,
          restIsNight: true,
          elevation: { dayIndex, fromHour: 1, hours: 4, bpm: 10 },
        });
        const spikes = detectHrAnomalies(
          shiftDay(FIRST_DAY, dayIndex),
          data
        ).filter(
          (anomaly) =>
            anomaly.type === "spike" && anomaly.hour >= 1 && anomaly.hour <= 4
        );
        trials++;
        if (spikes.length >= HR_ANOMALY_MIN_RUN_HOURS) found++;
      }
    }

    expect(found / trials).toBeGreaterThanOrEqual(0.9);
  });
});
