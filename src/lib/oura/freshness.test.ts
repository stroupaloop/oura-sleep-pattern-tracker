import { describe, expect, it } from "vitest";
import {
  parseUnavailableDatasets,
  projectLatestSyncAttempts,
  resolveDatasetFreshness,
  selectLatestDashboardSyncAttempt,
} from "./freshness";

describe("Oura sync freshness projection", () => {
  const rows = [
    {
      syncType: "manual",
      status: "success",
      errorMessage: null,
      createdAt: 100,
    },
    {
      syncType: "manual-sensitive",
      status: "partial",
      errorMessage:
        "daily_cardiovascular_age:unauthorized,vO2_max:forbidden",
      createdAt: 101,
    },
    {
      syncType: "cron-hr",
      status: "success",
      errorMessage: null,
      createdAt: 200,
    },
  ];

  it("keeps an HR-only attempt from implying full dashboard freshness", () => {
    expect(selectLatestDashboardSyncAttempt(rows, true)).toMatchObject({
      channel: "private",
      status: "partial",
      attemptedAt: 101,
    });
    expect(selectLatestDashboardSyncAttempt(rows, false)).toMatchObject({
      channel: "core",
      status: "success",
      attemptedAt: 100,
    });
  });

  it("projects each sync channel independently", () => {
    expect(projectLatestSyncAttempts(rows)).toMatchObject({
      core: { attemptedAt: 100, status: "success" },
      private: {
        attemptedAt: 101,
        status: "partial",
        unavailableDatasets: ["daily_cardiovascular_age", "vO2_max"],
      },
      "heart-rate": { attemptedAt: 200, status: "success" },
    });
  });

  it("parses only privacy-safe structured warning entries", () => {
    expect(
      parseUnavailableDatasets(
        "daily_spo2:rate_limited,daily_spo2:rate_limited,raw failure text"
      )
    ).toEqual(["daily_spo2"]);
    expect(parseUnavailableDatasets("token=secret:unexpected")).toEqual([]);
  });

  it("distinguishes checked, retained, unavailable, and unknown datasets", () => {
    const attempt = projectLatestSyncAttempts(rows).private;

    expect(
      resolveDatasetFreshness(attempt, "sleep_time", "2026-07-30")
    ).toMatchObject({ state: "checked", lastSourceDay: "2026-07-30" });
    expect(
      resolveDatasetFreshness(
        attempt,
        "daily_cardiovascular_age",
        "2026-07-29"
      )
    ).toMatchObject({ state: "retained", lastSourceDay: "2026-07-29" });
    expect(
      resolveDatasetFreshness(attempt, "vO2_max", null)
    ).toMatchObject({ state: "unavailable", lastSourceDay: null });
    expect(resolveDatasetFreshness(null, "sleep_time", null)).toEqual({
      state: "unknown",
      attemptedAt: null,
      lastSourceDay: null,
    });
  });
});
