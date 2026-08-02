import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityRecoveryChart } from "./activity-recovery-chart";
import { CardiovascularAgeChart } from "./cardiovascular-age-chart";
import { CircadianChart } from "./circadian-chart";
import { CorrelationView } from "./correlation-view";
import { HourlyHrChart } from "./hourly-hr-chart";
import { RestingHrChart } from "./resting-hr-chart";
import { VariabilityChart } from "./variability-chart";
import { Vo2MaxChart } from "./vo2-max-chart";
import { WithinNightChart } from "./within-night-chart";

describe("compact chart context", () => {
  it("labels scatterplots as relationships and discloses paired-day limits", () => {
    const html = renderToStaticMarkup(
      createElement(CorrelationView, {
        pairs: [
          {
            title: "HRV vs Sleep",
            xLabel: "HRV (ms)",
            yLabel: "Sleep (h)",
            data: [],
          },
        ],
      })
    );

    expect(html).toContain("Metric Relationships");
    expect(html).toContain("N=0 paired days");
    expect(html).toContain("do not calculate correlation or show causation");
  });

  it("explains requirements instead of showing empty technical plots", () => {
    const variability = renderToStaticMarkup(
      createElement(VariabilityChart, { data: [] })
    );
    const withinNight = renderToStaticMarkup(
      createElement(WithinNightChart, { data: [] })
    );
    const circadian = renderToStaticMarkup(
      createElement(CircadianChart, { data: [] })
    );
    const activity = renderToStaticMarkup(
      createElement(ActivityRecoveryChart, { data: [] })
    );
    const restingHr = renderToStaticMarkup(
      createElement(RestingHrChart, { data: [] })
    );

    expect(variability).toContain("enough measured values");
    expect(withinNight).toContain("No eligible 5-minute HR, HRV, or hypnogram");
    expect(circadian).toContain("IS needs 3 consecutive activity days");
    expect(activity).toContain("No daily steps or active-minute values");
    expect(activity).toContain("No Oura high-stress or restorative-time values");
    expect(restingHr).toContain("No Oura-labelled rest or awake heart-rate");
  });

  it("separates coefficients of variation from other variation measures", () => {
    const variability = renderToStaticMarkup(
      createElement(VariabilityChart, {
        data: [
          {
            day: "2026-07-31",
            sleepCV: 0.12,
            bedtimeCV: 0.03,
            wakeCV: 0.04,
          },
        ],
      })
    );
    const withinNight = renderToStaticMarkup(
      createElement(WithinNightChart, {
        data: [
          {
            day: "2026-07-31",
            hrvCV: 0.14,
            hrCV: 0.08,
            fragmentation: 0.2,
          },
        ],
      })
    );

    expect(variability).toContain(
      "Sleep-duration coefficient of variation (%)"
    );
    expect(variability).toContain(
      "Circular clock-time variation index (0 = consistent)"
    );
    expect(withinNight).toContain(
      "Within-night coefficient of variation (%)"
    );
    expect(withinNight).toContain(
      "Adjacent 5-minute intervals with a sleep-stage change (%)"
    );
  });

  it("surfaces fitness source, unit, and visible-range context", () => {
    const cardiovascularAge = renderToStaticMarkup(
      createElement(CardiovascularAgeChart, {
        data: [{ day: "2026-07-31", vascularAge: 34 }],
        actualAge: 40,
      })
    );
    const vo2Max = renderToStaticMarkup(
      createElement(Vo2MaxChart, {
        data: [
          { day: "2026-07-01", vo2Max: 38 },
          { day: "2026-07-31", vo2Max: 39.2 },
        ],
      })
    );

    expect(cardiovascularAge).toContain("6 years below actual age");
    expect(cardiovascularAge).toContain("Oura category: Below");
    expect(cardiovascularAge).toContain("not a diagnosis");
    expect(vo2Max).toContain("Latest: 39.2 mL/kg/min");
    expect(vo2Max).toContain("Visible-range change: +1.2");
    expect(vo2Max).toContain("no population range is applied");
  });

  it("describes hourly markers as personal-pattern comparisons", () => {
    const html = renderToStaticMarkup(
      createElement(HourlyHrChart, {
        data: [
          {
            day: "2026-07-31",
            hour: 9,
            avgBpm: null,
            minBpm: null,
            maxBpm: null,
            source: null,
          },
        ],
      })
    );

    expect(html).toContain("prior average for the same local hour");
    expect(html).toContain("not clinical alerts");
    expect(html).toContain("No hourly heart-rate samples");
  });
});
