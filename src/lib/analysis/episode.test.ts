import { describe, expect, it } from "vitest";
import type { DailyAnalysisResult, DayMetrics } from "./anomaly";
import { DEFAULT_CONFIG } from "./config";
import { assessEpisode } from "./episode";

function metrics(day: string): DayMetrics {
  return {
    day,
    totalSleepMinutes: 330,
    bedtimeMinutes: -30,
    wakeTimeMinutes: 360,
    avgHrv: 56,
    avgHeartRate: 55,
    onsetLatencyMinutes: 15,
    remPct: 22,
    deepPct: 18,
    efficiency: 88,
    temperatureDelta: 0,
    restlessPeriods: 10,
    withinNightHrvCV: Number.NaN,
    withinNightHrCV: Number.NaN,
    sleepStageTransitions: Number.NaN,
    hypnogramFragmentation: Number.NaN,
    lowestHeartRate: 48,
    averageBreath: 14,
    steps: 8_000,
    activeMinutes: 45,
    activityClassFragmentation: Number.NaN,
    stressHigh: Number.NaN,
    recoveryHigh: Number.NaN,
    resilienceLevel: null,
    sleepTimingScore: Number.NaN,
    readinessScore: 80,
    temperatureDeviation: 0,
    temperatureTrendDeviation: Number.NaN,
    dayToDaySleepCV: Number.NaN,
    dayToDayBedtimeCV: Number.NaN,
    dayToDayWakeCV: Number.NaN,
    circadianIS: Number.NaN,
    circadianIV: Number.NaN,
    circadianRA: Number.NaN,
    moodScore: null,
    energyScore: null,
    irritabilityScore: null,
    anxietyScore: null,
    averageSpo2: null,
    breathingDisturbanceIndex: null,
    episodeState: null,
  };
}

function flaggedNight(day: string): DailyAnalysisResult {
  return {
    day,
    metrics: metrics(day),
    baselines: { sleep: 420, hrv: 50, hr: 55 },
    zScores: {
      sleep: -1.7,
      hrv: 1.2,
      hr: 0,
      bedtime: 0,
      temperature: 0,
      efficiency: 0,
      latency: 0,
      withinNightVar: 0,
      activity: 0,
      circadianIV: 0,
      deepPct: 0,
      remPct: 0,
    },
    compositeScore: 2,
    isAnomaly: true,
    direction: "hyper",
    notes: "",
  };
}

const NIGHTS = ["2026-07-01", "2026-07-02", "2026-07-03"].map(flaggedNight);
const EXPECTED = { 3: 3, 5: 5, 7: 7 };

describe("assessEpisode text follows the configured thresholds", () => {
  it("names a driver once it passes the daily threshold, whichever that is", () => {
    const usual = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      DEFAULT_CONFIG,
      EXPECTED
    );
    expect(usual.tier).not.toBe("none");
    expect(usual.primaryDrivers.join(" ")).toMatch(/Sleep duration reduced/);

    const calm = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      { ...DEFAULT_CONFIG, dailyAnomalyThreshold: 2 },
      EXPECTED
    );
    expect(calm.primaryDrivers.join(" ")).not.toMatch(/Sleep duration/);
  });

  it("lists what was detected from the concern threshold", () => {
    const usual = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      DEFAULT_CONFIG,
      EXPECTED
    );
    expect(usual.researchContext?.whatWeDetected.join(" ")).toMatch(/HRV/);

    const stricter = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      { ...DEFAULT_CONFIG, concernThreshold: 1.3 },
      EXPECTED
    );
    expect(stricter.researchContext?.whatWeDetected.join(" ")).not.toMatch(
      /HRV/
    );
  });

  it("labels evidence by the configured tier cut-offs", () => {
    const strict = assessEpisode(
      "2026-07-03",
      NIGHTS,
      [],
      { ...DEFAULT_CONFIG, watchMinConfidence: 2.5, alertMinConfidence: 9 },
      EXPECTED
    );
    expect(strict.researchContext?.confidence ?? "low").not.toBe("high");
  });
});

describe("how many concerning nights each tier needs", () => {
  // Evidence bars are lowered so the night counts are what decides the tier.
  const LOW_BAR = {
    ...DEFAULT_CONFIG,
    watchMinConfidence: 0,
    warningMinConfidence: 0,
    alertMinConfidence: 0,
  };
  const LINE = DEFAULT_CONFIG.concernThreshold;
  const HIGH = 3.5;
  const QUIET = LINE - 0.1;

  /** Nights ending 2026-07-<last>, oldest first: [composite score, activation]. */
  function run(nights: Array<[number, number]>) {
    return nights.map(([compositeScore, activation], index) => {
      const date = new Date(Date.UTC(2026, 6, 1 + index)).toISOString().slice(0, 10);
      return {
        ...flaggedNight(date),
        compositeScore,
        activation,
        direction: activation > 0 ? ("hyper" as const) : activation < 0 ? ("hypo" as const) : null,
      };
    });
  }
  function assess(
    nights: Array<[number, number]>,
    expected: Record<number, number> = { 3: 3, 5: 5, 7: 7, 14: 14 }
  ) {
    const recent = run(nights);
    return assessEpisode(recent[recent.length - 1].day, recent, [], LOW_BAR, expected);
  }

  it("keeps Watch and Warning on an unbroken run", () => {
    const scattered = assess([[HIGH, 1], [QUIET, 0.2], [HIGH, 1]]);
    expect(scattered.tier).toBe("none");
    expect(scattered.consecutiveConcerningDays).toBe(1);

    const unbroken = assess([[QUIET, 0.2], [HIGH, 1], [HIGH, 1]]);
    expect(unbroken.tier).toBe("watch");
    expect(unbroken.researchContext?.persistence).toEqual({ nights: 2, span: 2 });
    expect(unbroken.summary).toMatch(/higher-activation pattern on each of the last 2 nights/);
  });

  it("lets Alert skip two nights of the last seven, when the rest lean the pattern's way", () => {
    const skipped = assess([
      [HIGH, 1], [QUIET, 0.2], [HIGH, 1], [HIGH, 1], [QUIET, 0.2], [HIGH, 1], [HIGH, 1],
    ]);
    expect(skipped.tier).toBe("alert");
    expect(skipped.direction).toBe("hyper");
    expect(skipped.researchContext?.persistence).toEqual({ nights: 5, span: 7 });
    expect(skipped.summary).toMatch(/pattern on 5 of the last 7 nights/);
    expect(skipped.consecutiveConcerningDays).toBe(2);

    const tooMany = assess([
      [HIGH, 1], [QUIET, 0.2], [QUIET, 0.2], [HIGH, 1], [QUIET, 0.2], [HIGH, 1], [HIGH, 1],
    ]);
    expect(tooMany.tier).toBe("watch");
  });

  it("does not count a concerning night that leans the other way toward Alert", () => {
    const mostlyAgainst = assess([
      [HIGH, -0.2], [HIGH, -0.2], [HIGH, -0.2], [HIGH, 2], [HIGH, 2], [HIGH, 2], [HIGH, 2],
    ]);
    expect(mostlyAgainst.direction).toBe("hyper");
    expect(mostlyAgainst.tier).toBe("warning");
    expect(mostlyAgainst.consecutiveConcerningDays).toBe(7);
  });

  it("says how far the latest night has eased from the stretch's peak, in the app's own word", () => {
    const eased = assess([[HIGH, 1], [HIGH, 1], [2, 1]]);
    expect(eased.tier).not.toBe("none");
    expect(eased.summary).toMatch(/Eased from its peak: 43%\./);
    expect(eased.summary).not.toMatch(/bounce/i);
  });

  it("stops at Watch when the nights lean toward neither side", () => {
    const unclear = assess(Array.from({ length: 7 }, () => [HIGH, 0] as [number, number]));
    expect(unclear.direction).toBeNull();
    expect(unclear.consecutiveConcerningDays).toBe(7);
    expect(unclear.tier).toBe("watch");
  });

  it("no longer calls a pattern lower once the latest night swings clearly higher, and holds it at Watch", () => {
    const lowerNights: Array<[number, number]> = Array.from({ length: 7 }, () => [HIGH, -1]);
    const steady = assess(lowerNights);
    expect(steady.direction).toBe("hypo");
    expect(steady.tier).toBe("alert");

    const swung = assess([...lowerNights.slice(1), [HIGH, 1.8]]);
    expect(swung.direction).toBeNull();
    expect(swung.tier).toBe("watch");

    const milder = assess([...lowerNights.slice(1), [HIGH, 0.6]]);
    expect(milder.direction).toBe("hypo");
  });

  describe("the two-week view", () => {
    // Eight concerning nights of fourteen, never two in a row at the end.
    const slide = (activation: number): Array<[number, number]> =>
      [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0].map(
        (concerning) => [concerning ? 1.6 : 0.9, concerning ? activation : activation / 2]
      );

    it("flags a slow lower-activation slide that no week of it would", () => {
      const result = assess(slide(-1));
      expect(result.tier).toBe("watch");
      expect(result.direction).toBe("hypo");
      expect(result.bestWindowDays).toBe(14);
      expect(result.researchContext?.persistence).toEqual({ nights: 8, span: 14 });
      expect(result.summary).toMatch(/lower-activation pattern on 8 of the last 14 nights/);
      expect(result.consecutiveConcerningDays).toBe(0);
    });

    it("does not read the same nights as a pattern when they lean higher", () => {
      const result = assess(slide(1));
      expect(result.tier).toBe("none");
      expect(result.bestWindowDays).not.toBe(14);
    });

    // Ten concerning nights leaning lower among the first thirteen, then a quiet last night.
    const withLastNight = (last: [number, number]): Array<[number, number]> => [
      ...[...("CCCqCCCCqCqCC")].map((night): [number, number] =>
        night === "C" ? [1.6, -1] : [0.9, -0.5]
      ),
      last,
    ];

    it("is set aside when the latest night swings clearly toward higher activation", () => {
      const swung = assess(withLastNight([0.9, 1.8]));
      expect(swung.tier).toBe("none");
      expect(swung.direction).not.toBe("hypo");
    });

    it("stays when the latest night only leans a little the other way", () => {
      const result = assess(withLastNight([0.9, 0.6]));
      expect(result.bestWindowDays).toBe(14);
      expect(result.direction).toBe("hypo");
      expect(result.tier).toBe("warning");
      expect(result.researchContext?.persistence).toEqual({ nights: 10, span: 14 });
    });

    it("lets go once the latest night has eased far enough", () => {
      const nights = slide(-1);
      nights[13] = [0.2, -0.1];
      expect(assess(nights).tier).toBe("none");
    });

    it("asks more of the nights for each higher tier", () => {
      // C: a concerning night leaning lower; q: a quiet one.
      const fortnight = (nights: string): Array<[number, number]> =>
        [...nights].map((night) => (night === "C" ? [1.6, -1] : [0.9, -0.5]));

      const ten = assess(fortnight("CCCqCCCCqCqCCq"));
      expect(ten.tier).toBe("warning");
      expect(ten.researchContext?.persistence).toEqual({ nights: 10, span: 14 });

      const seven = assess(fortnight("CqCqCqCqCqCCqq"));
      expect(seven.tier).toBe("none");
    });
  });
});
