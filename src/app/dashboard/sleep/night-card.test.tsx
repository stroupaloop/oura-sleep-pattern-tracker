import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildSignals } from "@/lib/health/signals";
import { NightCardContent, type AnalysisData, type NightData } from "./night-card";

const night: NightData = {
  id: "night-1",
  day: "2026-07-31",
  bedtimeStart: "2026-07-30T23:10:00-04:00",
  bedtimeEnd: "2026-07-31T05:40:00-04:00",
  totalSleepDuration: 6 * 3600,
  deepSleepDuration: 3600,
  lightSleepDuration: 3 * 3600,
  remSleepDuration: 2 * 3600,
  efficiency: 88,
  latency: 600,
  restlessPeriods: 200,
  averageHeartRate: 58,
  lowestHeartRate: 50,
  averageHrv: 42,
  temperatureDelta: 0.1,
  hypnogram5min: null,
  hr5min: null,
};

/** A night 1.7 standard deviations short of her usual sleep. */
function analysisAt(threshold: number): AnalysisData {
  const signals = buildSignals(
    {
      day: night.day,
      totalSleepMinutes: 360,
      baselineSleepMinutes: 420,
      sleepDurationZScore: -1.7,
      bedtimeStartMinutes: null,
      baselineBedtimeMinutes: null,
      bedtimeZScore: null,
      wakeTimeMinutes: null,
      baselineWakeMinutes: null,
      wakeTimeZScore: null,
      avgHrv: null,
      baselineHrv: null,
      hrvZScore: null,
      avgHeartRate: null,
      baselineHeartRate: null,
      heartRateZScore: null,
      temperatureDeviation: null,
      baselineTemperature: null,
      temperatureZScore: null,
      efficiency: 88,
      baselineEfficiency: 89,
      efficiencyZScore: -0.3,
    },
    threshold
  );
  return {
    hrvZScore: 0,
    sleepDurationZScore: -1.7,
    efficiencyZScore: -0.3,
    isAnomaly: true,
    anomalyDirection: "hyper",
    sleep: signals.find((signal) => signal.key === "sleep") ?? null,
    efficiency: signals.find((signal) => signal.key === "efficiency") ?? null,
  };
}

function render(threshold: number) {
  return renderToStaticMarkup(
    createElement(NightCardContent, {
      night,
      analysis: analysisAt(threshold),
      threshold,
    })
  );
}

describe("NightCardContent", () => {
  it("compares the night with her usual range, not population norms", () => {
    const html = render(1.5);

    expect(html).toContain("1h 0m less than usual");
    expect(html).toContain("usual 7h 0m");
    expect(html).toContain("About usual");
    expect(html).not.toMatch(/General range|Near range|Outside range/);
  });

  it("calls a measure unusual at the configured threshold, not at 2", () => {
    const sensitive = render(1.5);
    const strict = render(2);

    expect(sensitive).toContain("Unusual");
    expect(sensitive).toContain(
      "Sleep duration is well below your personal baseline."
    );
    expect(strict).not.toContain("Unusual");
    expect(strict).not.toContain("Sleep duration is well below");
  });
});
