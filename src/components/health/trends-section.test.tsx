import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { presetsFor, resolveDateRange } from "@/lib/date-range";
import type { HealthDashboardData } from "@/lib/health/health-dashboard-data";
import { TrendsSection } from "./trends-section";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/health",
  useSearchParams: () => new URLSearchParams(),
}));

const TODAY = "2026-10-09";
const PRESETS = presetsFor(["14d", "30d", "90d", "180d", "1y"]);

type Trends = HealthDashboardData["trends"];

function chartRow(day: string) {
  return {
    day,
    hours: 7,
    deep: 1.4,
    rem: 1.7,
    light: 3.9,
    efficiency: 90,
    hrv: 42,
    hr: 58,
  };
}

function compositionRow(day: string) {
  return {
    day,
    deep: 20,
    rem: 25,
    light: 50,
    awake: 5,
    deepMin: 84,
    remMin: 102,
    lightMin: 234,
    awakeMin: 30,
  };
}

const WITH_NIGHTS: Trends = {
  chartData: [chartRow("2026-10-07"), chartRow("2026-10-08")],
  analysisChartData: [],
  compositionData: [compositionRow("2026-10-07"), compositionRow("2026-10-08")],
  averageSleepSeconds: 25_200,
  nightsCounted: 2,
  windowDays: 30,
};

const NO_NIGHTS: Trends = {
  chartData: [],
  analysisChartData: [],
  compositionData: [],
  averageSleepSeconds: null,
  nightsCounted: 0,
  windowDays: 31,
};

function render(trends: Trends, params: Record<string, string> = {}) {
  const range = resolveDateRange(params, {
    today: TODAY,
    defaultToken: "30d",
    allowAll: false,
  });
  return renderToStaticMarkup(
    <TrendsSection
      trends={trends}
      threshold={1.5}
      today={TODAY}
      range={range}
      presets={PRESETS}
    />
  );
}

describe("TrendsSection", () => {
  it("names the days on screen and the nights behind the average", () => {
    const html = render(WITH_NIGHTS);

    expect(html).toContain(">Trends<");
    expect(html).toContain("Showing Sep 10 – Oct 9, 2026 · 30 days");
    expect(html).toContain("Average 7h 0m asleep");
    expect(html).toContain("2 nights recorded");
    expect(html).toContain("Hours in each stage over 30 days");
  });

  it("says one night in the singular", () => {
    const html = render({
      ...WITH_NIGHTS,
      chartData: [chartRow("2026-10-08")],
      nightsCounted: 1,
    });

    expect(html).toContain("1 night recorded");
  });

  it("shows the dates a past range covers", () => {
    const html = render(WITH_NIGHTS, { from: "2026-07-01", to: "2026-07-31" });

    expect(html).toContain("Showing Jul 1 – Jul 31, 2026 · 31 days");
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("From");
  });

  it("dates the stage shares by the days they cover, not by the last 14", () => {
    const html = render(WITH_NIGHTS);

    expect(html).toContain("share of time in bed, Oct 7 – Oct 8");
    expect(html).not.toContain("last 2 days");
  });

  it("keeps the control when the range holds no nights, and says so", () => {
    const html = render(NO_NIGHTS, { from: "2026-01-01", to: "2026-01-31" });

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("Showing Jan 1 – Jan 31, 2026 · 31 days");
    expect(html).toContain("No nights recorded in this range.");
    expect(html).not.toContain("Average");
    expect(html).not.toContain("Hours in each stage");
  });
});
