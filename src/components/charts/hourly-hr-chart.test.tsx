import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  HR_ANOMALY_BASELINE_DAYS,
  HR_ANOMALY_MIN_BASELINE_DAYS,
  HR_ANOMALY_MIN_RUN_HOURS,
  HR_ANOMALY_Z_THRESHOLD,
  HR_ELEVATED_RESTING_HOURS,
  type HourlyHrPoint,
} from "@/lib/hr-anomalies";
import { HourlyHrChart } from "./hourly-hr-chart";

const data: HourlyHrPoint[] = [
  {
    day: "2026-03-20",
    hour: 2,
    avgBpm: 55,
    minBpm: 52,
    maxBpm: 58,
    source: "sleep",
  },
];

describe("HourlyHrChart", () => {
  it("says what its amber markers mean, with the numbers the rule uses", () => {
    const html = renderToStaticMarkup(
      createElement(HourlyHrChart, { data, firstDay: "2026-03-01" })
    );

    expect(html).toContain("Amber marks overnight hours (12a–7a)");
    expect(html).toContain(
      `more than ${HR_ANOMALY_Z_THRESHOLD} standard deviations above or below your average for the same hour over the previous ${HR_ANOMALY_BASELINE_DAYS} days`
    );
    expect(html).toContain(
      `at least ${HR_ANOMALY_MIN_RUN_HOURS} hours in a row`
    );
    expect(html).toContain(`at least ${HR_ELEVATED_RESTING_HOURS} in a row`);
    expect(html).toContain(
      `An hour needs at least ${HR_ANOMALY_MIN_BASELINE_DAYS} of those days to be compared`
    );
    expect(html).toContain("not clinical alerts");
  });
});
