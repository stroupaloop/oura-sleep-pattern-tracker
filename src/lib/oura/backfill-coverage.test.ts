import { describe, expect, it } from "vitest";
import { buildCoverageRows, windowDayCount } from "./backfill-coverage";

describe("windowDayCount", () => {
  it("counts the days of an inclusive range", () => {
    expect(windowDayCount("2026-07-05", "2026-10-02")).toBe(90);
    expect(windowDayCount("2026-10-02", "2026-10-02")).toBe(1);
    expect(windowDayCount("2026-10-02", "2026-10-01")).toBe(0);
  });
});

describe("buildCoverageRows", () => {
  const productionGrant = new Set([
    "email",
    "personal",
    "daily",
    "heartrate",
    "workout",
    "tag",
    "session",
  ]);

  it("marks the datasets Oura is not sharing instead of reporting zero days", () => {
    const rows = buildCoverageRows(
      {
        sleep: { days: 84, latestDay: "2026-10-02" },
        heartrate: { days: 90, latestDay: "2026-10-02" },
      },
      productionGrant,
      true
    );
    const byDataset = Object.fromEntries(rows.map((row) => [row.dataset, row]));

    expect(byDataset.sleep).toMatchObject({ days: 84, notShared: false });
    expect(byDataset.heartrate).toMatchObject({ days: 90, notShared: false });
    expect(byDataset.daily_spo2).toMatchObject({ days: 0, notShared: true });
    expect(byDataset.daily_resilience.notShared).toBe(true);
    expect(byDataset.vO2_max.notShared).toBe(true);
    expect(byDataset.sleep_time.notShared).toBe(false);
  });

  it("lists private datasets only when they were synced", () => {
    const datasets = buildCoverageRows({}, null, false).map((row) => row.dataset);

    expect(datasets).toContain("daily_readiness");
    expect(datasets).not.toContain("vO2_max");
  });
});
