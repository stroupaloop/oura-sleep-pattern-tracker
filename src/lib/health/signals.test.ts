import { describe, expect, it } from "vitest";
import {
  buildSignals,
  formatMinutes,
  type NightAnalysis,
} from "./signals";

const BASE: NightAnalysis = {
  day: "2026-10-01",
  totalSleepMinutes: 305,
  baselineSleepMinutes: 424,
  sleepDurationZScore: -2.3,
  bedtimeStartMinutes: 20,
  baselineBedtimeMinutes: -15,
  bedtimeZScore: 1.1,
  wakeTimeMinutes: 450,
  baselineWakeMinutes: 452,
  wakeTimeZScore: -0.1,
  avgHrv: 27.4,
  baselineHrv: 30.2,
  hrvZScore: -0.7,
  avgHeartRate: 66.3,
  baselineHeartRate: 63,
  heartRateZScore: 1.6,
  temperatureDeviation: 0.31,
  baselineTemperature: 0.02,
  temperatureZScore: 1.4,
  efficiency: 87,
  baselineEfficiency: 88,
  efficiencyZScore: -0.6,
};

function byKey(analysis: NightAnalysis, threshold = 1.5) {
  return Object.fromEntries(
    buildSignals(analysis, threshold).map((signal) => [signal.key, signal])
  );
}

describe("formatMinutes", () => {
  it("matches the app's duration style", () => {
    expect(formatMinutes(48)).toBe("48m");
    expect(formatMinutes(-119)).toBe("1h 59m");
    expect(formatMinutes(424)).toBe("7h 4m");
  });
});

describe("buildSignals", () => {
  it("says how each measure departs from the usual, in plain words", () => {
    const signals = byKey(BASE);

    expect(signals.sleep).toMatchObject({
      value: "5h 5m",
      comparison: "1h 59m less than usual",
      usualValue: "7h 4m",
      level: "unusual",
    });
    expect(signals.bedtime).toMatchObject({
      value: "12:20 AM",
      comparison: "35m later than usual",
      usualValue: "11:45 PM",
      level: "outside",
    });
    expect(signals.wake).toMatchObject({ comparison: "About usual", level: "usual" });
    expect(signals.hrv).toMatchObject({
      value: "27 ms",
      comparison: "3 ms below usual",
    });
    expect(signals.heartRate).toMatchObject({
      value: "66 bpm",
      comparison: "3 bpm above usual",
      level: "unusual",
    });
    expect(signals.temperature).toMatchObject({
      value: "+0.3 °C",
      comparison: "0.3 °C warmer than usual",
      usualValue: "0.0 °C",
    });
    expect(signals.efficiency).toMatchObject({
      comparison: "1 point below usual",
    });
  });

  it("follows the configured daily threshold", () => {
    expect(byKey(BASE, 2.5).sleep.level).toBe("outside");
    expect(byKey(BASE, 1.2).temperature.level).toBe("unusual");
  });

  it("keeps the value but makes no comparison before a baseline exists", () => {
    const signals = byKey({
      ...BASE,
      baselineSleepMinutes: null,
      sleepDurationZScore: null,
    });

    expect(signals.sleep).toMatchObject({
      value: "5h 5m",
      comparison: "Not enough nights for a baseline yet",
      usualValue: null,
      z: null,
      level: "unknown",
    });
  });

  it("leaves out measures the night does not have", () => {
    const signals = byKey({ ...BASE, avgHrv: null, temperatureDeviation: null });

    expect(signals.hrv).toBeUndefined();
    expect(signals.temperature).toBeUndefined();
  });

  it("returns nothing without an analysis", () => {
    expect(buildSignals(null, 1.5)).toEqual([]);
  });
});
