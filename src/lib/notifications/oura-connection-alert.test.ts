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
  needsReconnect: boolean,
  times: {
    since?: number;
    last?: number;
    previous?: number | null;
  } = {}
): OuraConnectionHealth {
  return {
    state: "failing",
    lastSyncedAt: LAST_STORED,
    failingSince: times.since ?? FAILED_AT,
    consecutiveFailures,
    lastFailureAt: times.last ?? FAILED_AT,
    previousFailureAt: times.previous ?? null,
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

const at = (iso: string) => Date.parse(iso) / 1000;
// 10am, 11am ET on Sep 3; 6am, 10am, 11am ET on Sep 4; 6am ET on Sep 5.
const SEP3_10AM = at("2026-09-03T14:00:00Z");
const SEP3_11AM = at("2026-09-03T15:00:00Z");
const SEP4_6AM = at("2026-09-04T10:00:00Z");
const SEP4_10AM = at("2026-09-04T14:00:00Z");
const SEP4_11AM = at("2026-09-04T15:00:00Z");
const SEP5_6AM = at("2026-09-05T10:00:00Z");

describe("shouldSendOuraConnectionAlert", () => {
  it("reports a rejected connection at once, then on each new ET day", () => {
    const attempt = (last: number, previous: number | null) =>
      shouldSendOuraConnectionAlert(
        failing(2, true, { since: SEP3_10AM, last, previous })
      );

    expect(attempt(SEP3_10AM, null)).toBe(true);
    expect(attempt(SEP3_11AM, SEP3_10AM)).toBe(false);
    expect(attempt(SEP4_6AM, SEP3_11AM)).toBe(true);
    expect(attempt(SEP4_10AM, SEP4_6AM)).toBe(false);
  });

  it("reports other failures once they have lasted a day, then daily", () => {
    const attempt = (last: number, previous: number | null) =>
      shouldSendOuraConnectionAlert(
        failing(2, false, { since: SEP3_10AM, last, previous })
      );

    expect(attempt(SEP3_10AM, null)).toBe(false);
    expect(attempt(SEP3_11AM, SEP3_10AM)).toBe(false);
    expect(attempt(SEP4_6AM, SEP3_11AM)).toBe(false);
    expect(attempt(SEP4_10AM, SEP4_6AM)).toBe(true);
    expect(attempt(SEP4_11AM, SEP4_10AM)).toBe(false);
    expect(attempt(SEP5_6AM, SEP4_11AM)).toBe(true);
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
