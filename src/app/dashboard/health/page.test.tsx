import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RangePreset, ResolvedRange } from "@/lib/date-range";
import HealthPage from "./page";

const loadHealthDashboard = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: async () => null,
  isSensitiveUser: () => false,
}));
vi.mock("@/lib/daily-log-data", () => ({
  loadDailyLog: async () => ({ medications: [], mood: null, medLogs: [] }),
}));
vi.mock("@/lib/health/health-dashboard-data", () => ({ loadHealthDashboard }));
vi.mock("@/components/health/health-dashboard", () => ({
  HealthDashboard: () => null,
}));

type DashboardProps = { range: ResolvedRange; rangePresets: RangePreset[] };

async function open(params: Record<string, string>) {
  return (await HealthPage({
    searchParams: Promise.resolve(params),
  })) as ReactElement<DashboardProps>;
}

describe("Health page date range", () => {
  beforeEach(() => {
    loadHealthDashboard.mockReset();
    loadHealthDashboard.mockResolvedValue({ connection: null });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T16:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("charts the last 30 days unless told otherwise", async () => {
    const { props } = await open({});

    expect(loadHealthDashboard).toHaveBeenCalledWith({
      start: "2026-09-10",
      end: "2026-10-09",
    });
    expect(props.range).toMatchObject({ kind: "relative", token: "30d" });
  });

  it("offers the presets that make sense for sleep trends", async () => {
    const { props } = await open({});

    expect(props.rangePresets.map((preset) => preset.value)).toEqual([
      "14d",
      "30d",
      "90d",
      "180d",
      "1y",
    ]);
  });

  it("takes a preset", async () => {
    const { props } = await open({ range: "90d" });

    expect(loadHealthDashboard).toHaveBeenCalledWith({
      start: "2026-07-12",
      end: "2026-10-09",
    });
    expect(props.range.token).toBe("90d");
  });

  it("takes from and to", async () => {
    const { props } = await open({ from: "2026-03-01", to: "2026-03-31" });

    expect(loadHealthDashboard).toHaveBeenCalledWith({
      start: "2026-03-01",
      end: "2026-03-31",
    });
    expect(props.range).toMatchObject({ kind: "absolute", days: 31 });
  });

  it("does not chart all time, which it has no preset for", async () => {
    await open({ range: "all" });

    expect(loadHealthDashboard).toHaveBeenCalledWith({
      start: "2026-09-10",
      end: "2026-10-09",
    });
  });

  it("asks to connect the ring before there is anything to chart", async () => {
    loadHealthDashboard.mockResolvedValue(null);

    const html = renderToStaticMarkup(await open({ range: "90d" }));

    expect(html).toContain("Connect Oura Ring");
  });
});
