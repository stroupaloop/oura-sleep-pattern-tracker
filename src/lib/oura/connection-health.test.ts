import { describe, expect, it } from "vitest";
import {
  assessOuraConnection,
  shouldShowOuraConnectionProblem,
} from "./connection-health";
import type { SyncAttemptRow } from "./freshness";

const REFRESH_FAILURE = "Oura request failed for token_refresh with HTTP 400";

function attempt(
  createdAt: number,
  status: string,
  overrides: Partial<SyncAttemptRow> = {}
): SyncAttemptRow {
  return {
    syncType: "cron",
    status,
    errorMessage: status === "error" ? REFRESH_FAILURE : null,
    createdAt,
    ...overrides,
  };
}

describe("assessOuraConnection", () => {
  it("reports the rejected-token outage that began on Sep 3", () => {
    const rows = [
      attempt(5000, "error"),
      attempt(4000, "error"),
      attempt(3000, "error"),
      attempt(2000, "partial", { errorMessage: "daily_resilience:unauthorized" }),
      attempt(1000, "success"),
    ];

    expect(assessOuraConnection(rows)).toEqual({
      state: "failing",
      lastSyncedAt: 2000,
      failingSince: 3000,
      consecutiveFailures: 3,
      lastFailureAt: 5000,
      previousFailureAt: 4000,
      needsReconnect: true,
      lastError: REFRESH_FAILURE,
    });
  });

  it("reads rows in any order and ignores the heart-rate and private channels", () => {
    const rows = [
      attempt(1000, "success"),
      attempt(4000, "error", { syncType: "cron-hr", errorMessage: "heartrate:api_error" }),
      attempt(3000, "error", { syncType: "cron-sensitive" }),
      attempt(2000, "error", { errorMessage: "Oura request failed for v2/usercollection/sleep with HTTP 503" }),
    ];

    expect(assessOuraConnection(rows)).toMatchObject({
      state: "failing",
      lastSyncedAt: 1000,
      consecutiveFailures: 1,
      needsReconnect: false,
    });
  });

  it("falls back to the newest stored sync when the window holds only failures", () => {
    expect(
      assessOuraConnection([attempt(9000, "error")], 1200)
    ).toMatchObject({ lastSyncedAt: 1200, failingSince: 9000 });
  });

  it("is healthy once a sync stores data again", () => {
    expect(
      assessOuraConnection([attempt(6000, "partial"), attempt(5000, "error")])
    ).toMatchObject({
      state: "ok",
      consecutiveFailures: 0,
      needsReconnect: false,
      lastError: null,
    });
  });

  it("is unknown before the first sync", () => {
    expect(assessOuraConnection([])).toMatchObject({
      state: "unknown",
      lastSyncedAt: null,
    });
  });
});

describe("shouldShowOuraConnectionProblem", () => {
  it("interrupts at once for a rejected connection", () => {
    expect(
      shouldShowOuraConnectionProblem(
        assessOuraConnection([attempt(2000, "error"), attempt(1000, "success")])
      )
    ).toBe(true);
  });

  it("waits out a single upstream hiccup", () => {
    const upstream = {
      errorMessage: "Oura request failed for v2/usercollection/sleep with HTTP 503",
    };
    expect(
      shouldShowOuraConnectionProblem(
        assessOuraConnection([
          attempt(2000, "error", upstream),
          attempt(1000, "success"),
        ])
      )
    ).toBe(false);
    expect(
      shouldShowOuraConnectionProblem(
        assessOuraConnection([
          attempt(3000, "error", upstream),
          attempt(2000, "error", upstream),
          attempt(1000, "success"),
        ])
      )
    ).toBe(true);
  });
});
