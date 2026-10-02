import { describe, expect, it } from "vitest";
import {
  buildOuraConnectionAlert,
  ouraConnectionAlertsEnabled,
  shouldSendOuraConnectionAlert,
} from "./oura-connection-alert";
import type { OuraConnectionHealth } from "@/lib/oura/connection-health";

// 2026-09-03 03:00:35 UTC and 2026-09-02 21:03:20 UTC.
const FAILED_AT = 1788404435;
const LAST_STORED = 1788383000;

function failing(
  consecutiveFailures: number,
  needsReconnect: boolean
): OuraConnectionHealth {
  return {
    state: "failing",
    lastSyncedAt: LAST_STORED,
    failingSince: FAILED_AT,
    consecutiveFailures,
    needsReconnect,
    lastError: needsReconnect
      ? "Oura request failed for token_refresh with HTTP 400 (invalid_grant)"
      : "Oura request failed for v2/usercollection/sleep with HTTP 503",
  };
}

describe("ouraConnectionAlertsEnabled", () => {
  it("sends from production only unless the flag says otherwise", () => {
    expect(ouraConnectionAlertsEnabled({ vercelEnv: "production" })).toBe(true);
    expect(ouraConnectionAlertsEnabled({ vercelEnv: "preview" })).toBe(false);
    expect(
      ouraConnectionAlertsEnabled({ flag: "0", vercelEnv: "production" })
    ).toBe(false);
    expect(ouraConnectionAlertsEnabled({ flag: "1", nodeEnv: "development" })).toBe(
      true
    );
  });
});

describe("shouldSendOuraConnectionAlert", () => {
  it("reports a rejected connection on its first failure, then daily", () => {
    const sends = [1, 2, 3, 4, 5, 6, 9].filter((count) =>
      shouldSendOuraConnectionAlert(failing(count, true))
    );
    expect(sends).toEqual([1, 5, 9]);
  });

  it("waits a day before reporting other failures, then repeats daily", () => {
    const sends = [1, 2, 3, 4, 5, 8, 12].filter((count) =>
      shouldSendOuraConnectionAlert(failing(count, false))
    );
    expect(sends).toEqual([4, 8, 12]);
  });

  it("stays quiet while syncing works", () => {
    expect(
      shouldSendOuraConnectionAlert({
        ...failing(0, false),
        state: "ok",
      })
    ).toBe(false);
  });
});

describe("buildOuraConnectionAlert", () => {
  it("says what stopped, since when, and links to the fix", () => {
    const alert = buildOuraConnectionAlert({
      health: failing(1, true),
      siteUrl: "https://example.test/",
    });

    expect(alert.subject).toBe("Oura stopped syncing: reconnect needed");
    expect(alert.text).toContain("Last data stored: Wed, Sep 2, 5:03 PM ET");
    expect(alert.text).toContain("(invalid_grant)");
    expect(alert.text).toContain(
      "Reconnect Oura: https://example.test/dashboard/settings"
    );
    expect(alert.html).toContain('href="https://example.test/dashboard/settings"');
  });

  it("keeps health details out of the subject line", () => {
    const alert = buildOuraConnectionAlert({ health: failing(4, false) });

    expect(alert.subject).toBe("Oura sync keeps failing");
    expect(alert.text).not.toContain("http");
  });
});
