import { and, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@/lib/db";
import {
  cyclePredictions,
  dailyReadiness,
  dailySpo2,
  healthSignals,
  sleepPeriods,
} from "@/lib/db/schema";
import {
  canEvaluateCycleHealthSignals,
  getHealthSignalResolutionCopy,
  isCycleDependentHealthSignal,
  latestConsecutiveValues,
  latestConsecutiveMatchingRun,
  longestConsecutiveMatchingRun,
  isRecentMeasurementDay,
  isWithinRecentCalendarDays,
  personalBaselineZScore,
  PERSONAL_BASELINE_MIN_NIGHTS,
  runHealthSignalDetection,
} from "./health-signals";
import type { CycleComputationOutcome } from "./cycle";

vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/db/schema");
  return { db: drizzle(createClient({ url: ":memory:" }), { schema }) };
});

describe("health signal continuity", () => {
  const values = [
    { day: "2026-07-01", value: 1 },
    { day: "2026-07-02", value: 1 },
    { day: "2026-07-04", value: 1 },
    { day: "2026-07-05", value: 1 },
  ];

  it("uses only the latest consecutive baseline tail", () => {
    expect(latestConsecutiveValues(values, 14).map((row) => row.day)).toEqual([
      "2026-07-04",
      "2026-07-05",
    ]);
  });

  it("resets sustained evidence at a missing calendar day", () => {
    expect(longestConsecutiveMatchingRun(values, (value) => value > 0)).toBe(2);
  });

  it("requires a sustained pattern to reach the newest eligible day", () => {
    const normalized = [
      { day: "2026-07-01", value: 1 },
      { day: "2026-07-02", value: 1 },
      { day: "2026-07-03", value: 0 },
    ];
    expect(
      longestConsecutiveMatchingRun(normalized, (value) => value > 0)
    ).toBe(2);
    expect(
      latestConsecutiveMatchingRun(normalized, (value) => value > 0)
    ).toBe(0);
  });

  it("rejects stale measurements when creating a current signal", () => {
    expect(isRecentMeasurementDay("2026-07-30", "2026-07-30")).toBe(true);
    expect(isRecentMeasurementDay("2026-07-29", "2026-07-30")).toBe(true);
    expect(isRecentMeasurementDay("2026-07-28", "2026-07-30")).toBe(false);
    expect(
      isWithinRecentCalendarDays("2026-07-23", "2026-07-30", 7)
    ).toBe(true);
    expect(
      isWithinRecentCalendarDays("2026-07-22", "2026-07-30", 7)
    ).toBe(false);
  });

  it("compares nighttime heart rate with the individual's recent baseline", () => {
    expect(personalBaselineZScore(70, [60, 61, 59, 60, 61, 59, 60])).toBeGreaterThan(
      2
    );
    expect(personalBaselineZScore(70, [68, 69, 67, 70, 68, 69, 67])).toBeLessThan(
      2
    );
  });

  it("does not manufacture a z-score without a variable personal baseline", () => {
    expect(personalBaselineZScore(70, [60])).toBeNull();
    expect(personalBaselineZScore(70, [60, 60, 60])).toBeNull();
    expect(
      personalBaselineZScore(70, Array(PERSONAL_BASELINE_MIN_NIGHTS).fill(60))
    ).toBeNull();
  });

  it("does not score a night against fewer baseline nights than the minimum", () => {
    const nights = [60, 61, 59, 60, 61, 59, 60, 61];

    for (let count = 0; count < PERSONAL_BASELINE_MIN_NIGHTS; count++) {
      expect(personalBaselineZScore(70, nights.slice(0, count))).toBeNull();
    }
    expect(
      personalBaselineZScore(70, nights.slice(0, PERSONAL_BASELINE_MIN_NIGHTS))
    ).toBeGreaterThan(2);
  });

  it("does not reuse retained thermal shifts when the current cycle evaluation is insufficient", () => {
    const insufficientEvaluation: CycleComputationOutcome = {
      state: "insufficient_data",
      outcome: "insufficient_data",
      cycles: [],
      checkedThroughDay: "2026-08-02",
      latestTemperatureDay: "2026-07-30",
      eligibleTemperatureDays: 20,
      longestEligibleTemperatureRun: 20,
      currentEligibleTemperatureRun: 0,
      restModeExcludedTemperatureDays: 0,
      restModeActive: false,
      restModeCoverageLimited: false,
      insufficientReason: "insufficient_consecutive_data",
    };

    expect(canEvaluateCycleHealthSignals(insufficientEvaluation)).toBe(false);
    expect(isCycleDependentHealthSignal("sustained_temperature")).toBe(true);
    expect(isCycleDependentHealthSignal("thermal_shift_timing")).toBe(true);
    expect(isCycleDependentHealthSignal("acute_illness")).toBe(false);
    expect(
      getHealthSignalResolutionCopy(
        "sustained_temperature",
        "2026-08-02",
        false
      )
    ).toEqual({
      summary:
        "This prior temperature-based signal is no longer active because current coverage is insufficient to reevaluate it.",
      details:
        "Marked inactive on 2026-08-02; retained historical thermal shifts were not reused without a complete current temperature evaluation.",
    });
  });
});

const COMPLETE_EVALUATION: CycleComputationOutcome = {
  state: "complete",
  outcome: "shifts_detected",
  cycles: [],
  checkedThroughDay: "2026-03-31",
  latestTemperatureDay: "2026-03-31",
  eligibleTemperatureDays: 100,
  longestEligibleTemperatureRun: 100,
  currentEligibleTemperatureRun: 100,
  restModeExcludedTemperatureDays: 0,
  restModeActive: false,
  restModeCoverageLimited: false,
  insufficientReason: null,
};

const START = "2026-01-05";

function dayAt(offset: number): string {
  const date = new Date(`${START}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

interface SeedNight {
  day: string;
  heartRate: number;
  hrv?: number;
  temperature?: number;
  spo2?: number;
  /** A two-hour night, which Oura types `sleep` rather than `long_sleep`. */
  short?: boolean;
}

async function seedNights(nights: SeedNight[]) {
  const createdAt = 1_700_000_000;
  for (const night of nights) {
    const previous = new Date(`${night.day}T00:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    const evening = previous.toISOString().slice(0, 10);
    await db.insert(sleepPeriods).values({
      id: `night-${night.day}`,
      day: night.day,
      type: night.short ? "sleep" : "long_sleep",
      bedtimeStart: night.short
        ? `${night.day}T03:30:00-05:00`
        : `${evening}T23:30:00-05:00`,
      bedtimeEnd: night.short
        ? `${night.day}T05:40:00-05:00`
        : `${night.day}T07:30:00-05:00`,
      totalSleepDuration: night.short ? 7800 : 27000,
      averageHeartRate: night.heartRate,
      averageHrv: night.hrv ?? null,
      createdAt,
    });
    if (night.temperature !== undefined) {
      await db.insert(dailyReadiness).values({
        id: `readiness-${night.day}`,
        day: night.day,
        temperatureDeviation: night.temperature,
        createdAt,
      });
    }
    if (night.spo2 !== undefined) {
      await db.insert(dailySpo2).values({
        id: `spo2-${night.day}`,
        day: night.day,
        averageSpo2: night.spo2,
        createdAt,
      });
    }
  }
}

async function detectedSignal(day: string, signalType: string) {
  // Noon Eastern, so the app's "today" is `day` however the tests are run.
  vi.setSystemTime(new Date(`${day}T17:00:00Z`));
  await runHealthSignalDetection(COMPLETE_EVALUATION);
  const rows = await db
    .select()
    .from(healthSignals)
    .where(
      and(
        eq(healthSignals.day, day),
        eq(healthSignals.signalType, signalType),
        eq(healthSignals.status, "detected")
      )
    );
  return rows[0] ?? null;
}

describe("health signal detection", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    await db.delete(healthSignals);
    await db.delete(cyclePredictions);
    await db.delete(dailySpo2);
    await db.delete(dailyReadiness);
    await db.delete(sleepPeriods);
  });

  describe("sustained temperature pattern", () => {
    const FOLLICULAR_NIGHTS = 20;
    const SHIFT_INDEX = FOLLICULAR_NIGHTS;

    /**
     * Temperature steps up on the shift night and stays up for
     * `lutealNights`. Heart rate rises by `heartRateRise` with it, and the
     * last night can be a short one that Oura types `sleep`.
     */
    async function seedCycle(
      lutealNights: number,
      { heartRateRise = 0, shortLastNight = false } = {}
    ) {
      const length = FOLLICULAR_NIGHTS + lutealNights;
      const nights: SeedNight[] = Array.from({ length }, (_, index) => {
        const luteal = index >= SHIFT_INDEX;
        return {
          day: dayAt(index),
          heartRate:
            58 + ((index % 4) - 1.5) * 0.4 + (luteal ? heartRateRise : 0),
          temperature: (luteal ? 0.3 : -0.2) + ((index % 3) - 1) * 0.02,
          short: shortLastNight && index === length - 1,
        };
      });
      await seedNights(nights);
      await db.insert(cyclePredictions).values({
        cycleNumber: 1,
        thermalShiftDay: dayAt(SHIFT_INDEX),
        confidence: 0.6,
        createdAt: 1,
      });
    }

    /** Luteal nights counted so far (the shift night is 1) on each day the signal shows. */
    async function nightsOnWhichItShows(lutealNights: number) {
      const shown: number[] = [];
      for (let night = 1; night <= lutealNights; night++) {
        const signal = await detectedSignal(
          dayAt(SHIFT_INDEX + night - 1),
          "sustained_temperature"
        );
        if (signal) shown.push(night);
      }
      return shown;
    }

    it.each([11, 13, 15])(
      "never shows during an ordinary %i-night luteal phase",
      async (lutealNights) => {
        await seedCycle(lutealNights);

        expect(await nightsOnWhichItShows(lutealNights)).toEqual([]);
      }
    );

    it("shows from the eighteenth elevated night", async () => {
      await seedCycle(18);

      expect(await nightsOnWhichItShows(18)).toEqual([18]);
    });

    it("keeps showing while the elevation lasts past 18 nights", async () => {
      await seedCycle(22);

      expect(await nightsOnWhichItShows(22)).toEqual([18, 19, 20, 21, 22]);
    });

    it("starts at moderate evidence, on the nights that match alone", async () => {
      await seedCycle(22);

      const signal = await detectedSignal(
        dayAt(SHIFT_INDEX + 21),
        "sustained_temperature"
      );

      expect(signal?.confidence).toBeCloseTo(0.55);
      expect(JSON.parse(signal?.indicators ?? "[]")).toEqual([
        "Nighttime skin-temperature deviation remained elevated for 22 calendar-consecutive days after a detected thermal shift",
      ]);
    });

    it("adds to it when heart rate stayed up for two weeks too", async () => {
      await seedCycle(22, { heartRateRise: 5 });

      const signal = await detectedSignal(
        dayAt(SHIFT_INDEX + 21),
        "sustained_temperature"
      );

      expect(signal?.confidence).toBeCloseTo(0.7);
      expect(JSON.parse(signal?.indicators ?? "[]")).toContain(
        "Average heart rate during the night's sleep was elevated for 22 calendar-consecutive days"
      );
    });

    it("counts a short `sleep` night's heart rate among the elevated nights", async () => {
      await seedCycle(22, { heartRateRise: 5, shortLastNight: true });

      const signal = await detectedSignal(
        dayAt(SHIFT_INDEX + 21),
        "sustained_temperature"
      );

      expect(JSON.parse(signal?.indicators ?? "[]")).toContain(
        "Average heart rate during the night's sleep was elevated for 22 calendar-consecutive days"
      );
    });
  });

  describe("physiological strain", () => {
    const TODAY_INDEX = 30;
    const HEART_RATE = [57.2, 58.4, 57.8, 58.9, 58.1, 57.5, 58.6];
    const HRV = [54, 56, 55, 57, 55, 54, 56];
    const TEMPERATURE = [0.02, -0.03, 0.01, 0.04, -0.02, 0, 0.03];
    const SPO2_WOBBLE = [0.3, 0, -0.3, 0.1, -0.1, 0.2, -0.2];

    /**
     * Twenty-two usual nights, then tonight. Everything about tonight is
     * ordinary except what `tonight` changes.
     */
    async function seedUsualNights({
      spo2Usual,
      spo2Steadiness = 1,
      spo2Nights = 22,
      tonight = {},
    }: {
      spo2Usual?: number;
      spo2Steadiness?: number;
      spo2Nights?: number;
      tonight?: Partial<SeedNight>;
    }) {
      const nights: SeedNight[] = Array.from({ length: 22 }, (_, index) => {
        const offset = TODAY_INDEX - 22 + index;
        const pattern = index % 7;
        return {
          day: dayAt(offset),
          heartRate: HEART_RATE[pattern],
          hrv: HRV[pattern],
          temperature: TEMPERATURE[pattern],
          spo2:
            spo2Usual !== undefined && index >= 22 - spo2Nights
              ? spo2Usual + spo2Steadiness * SPO2_WOBBLE[pattern]
              : undefined,
        };
      });
      nights.push({
        day: dayAt(TODAY_INDEX),
        heartRate: HEART_RATE[0],
        hrv: HRV[0],
        temperature: TEMPERATURE[0],
        ...tonight,
      });
      await seedNights(nights);
    }

    const today = dayAt(TODAY_INDEX);

    it("counts a short `sleep` night as the latest night", async () => {
      await seedUsualNights({
        tonight: { short: true, heartRate: 64, hrv: 38 },
      });

      const signal = await detectedSignal(today, "acute_illness");

      expect(signal).not.toBeNull();
      expect(signal?.day).toBe(today);
      expect(JSON.parse(signal?.indicators ?? "[]")).toEqual([
        expect.stringMatching(
          /^Average heart rate during the night's sleep was \d+\.\d standard deviations above its recent baseline$/
        ),
        expect.stringMatching(/^Nighttime HRV was \d+% below its recent baseline$/),
      ]);
      expect(signal?.details).toMatch(/^Nightly average heart-rate z-score/);
    });

    it("signals the same for a night typed long_sleep", async () => {
      await seedUsualNights({ tonight: { heartRate: 64, hrv: 38 } });

      expect(await detectedSignal(today, "acute_illness")).not.toBeNull();
    });

    it("needs a second measurement beside a high heart rate", async () => {
      await seedUsualNights({ tonight: { heartRate: 64 } });

      expect(await detectedSignal(today, "acute_illness")).toBeNull();
    });

    it("does not count an SpO₂ that is her usual, even below 95", async () => {
      await seedUsualNights({
        spo2Usual: 94.2,
        tonight: { heartRate: 64, spo2: 94.1 },
      });

      expect(await detectedSignal(today, "acute_illness")).toBeNull();
    });

    it("counts an SpO₂ well below her own recent nights, and says by how much", async () => {
      await seedUsualNights({
        spo2Usual: 97,
        tonight: { heartRate: 64, spo2: 95.4 },
      });

      const signal = await detectedSignal(today, "acute_illness");

      expect(JSON.parse(signal?.indicators ?? "[]")).toContain(
        "Average overnight SpO₂ was 95.4%, 1.6 points below its recent baseline"
      );
      expect(signal?.confidence).toBeCloseTo(0.5);
    });

    it("does not count a drop that is large for a very steady baseline but under a point", async () => {
      await seedUsualNights({
        spo2Usual: 97,
        spo2Steadiness: 0.1,
        tonight: { heartRate: 64, spo2: 96.6 },
      });

      expect(await detectedSignal(today, "acute_illness")).toBeNull();
    });

    it("has no SpO₂ baseline to compare with before a week of nights", async () => {
      await seedUsualNights({
        spo2Usual: 97,
        spo2Nights: 5,
        tonight: { heartRate: 64, spo2: 94.5 },
      });

      expect(await detectedSignal(today, "acute_illness")).toBeNull();
    });
  });
});
