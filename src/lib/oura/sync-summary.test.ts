import { describe, expect, it } from "vitest";
import {
  formatOuraSyncSummary,
  formatSyncNowFailure,
  formatSyncNowResult,
} from "./sync-summary";

describe("Oura sync summary", () => {
  it("names partial sources and separates core from private records", () => {
    expect(
      formatOuraSyncSummary(
        {
          records: 44,
          sensitiveRecords: 2,
          warnings: [
            { dataset: "daily_resilience", code: "unauthorized" },
            {
              dataset: "daily_cardiovascular_age",
              code: "unauthorized",
            },
            { dataset: "vO2_max", code: "unauthorized" },
            { dataset: "sleep_time", code: "unauthorized" },
          ],
        },
        { operation: "Sync" }
      )
    ).toBe(
      "Sync complete with partial coverage: processed 44 core records and 2 private records. Optional datasets not fully updated: Resilience, Cardiovascular Age, VO₂ max, and Bedtime Guidance. The sync did not delete previously stored source rows for those datasets."
    );
  });

  it("tells data Oura did not share apart from data that failed", () => {
    expect(
      formatOuraSyncSummary(
        {
          records: 36,
          sensitiveRecords: 3,
          status: "partial",
          warnings: [
            { dataset: "daily_resilience", code: "not_granted" },
            { dataset: "daily_spo2", code: "not_granted" },
          ],
        },
        { operation: "Sync" }
      )
    ).toBe(
      "Sync complete with partial coverage: processed 36 core records and 3 private records. Not shared by Oura: Resilience and Blood Oxygen. Enable them for this app in Oura, then reconnect."
    );
    expect(
      formatOuraSyncSummary(
        {
          records: 36,
          sensitiveRecords: 3,
          warnings: [
            { dataset: "vO2_max", code: "not_granted" },
            { dataset: "heartrate", code: "rate_limited" },
          ],
        },
        { operation: "Sync" }
      )
    ).toBe(
      "Sync complete with partial coverage: processed 36 core records and 3 private records. Optional datasets not fully updated: Heart Rate. The sync did not delete previously stored source rows for those datasets. Not shared by Oura: VO₂ max. Enable it for this app in Oura, then reconnect."
    );
  });

  it("says how much history a backfill recomputed and which steps did not finish", () => {
    expect(
      formatOuraSyncSummary(
        {
          records: 448,
          sensitiveRecords: 66,
          status: "partial",
          warnings: [],
          failedSteps: [{ step: "cycle_predictions", message: "x" }],
          analysis: { daysProcessed: 412 },
          startDate: "2026-07-05",
          endDate: "2026-10-02",
        },
        { operation: "Backfill", includeRange: true }
      )
    ).toBe(
      "Backfill complete with partial coverage (2026-07-05 to 2026-10-02): processed 448 core records and 66 private records. Pattern checks recomputed for 412 nights. Didn't finish: cycle context. Running it again usually completes it."
    );
  });

  it("includes a backfill range without implying partial coverage", () => {
    expect(
      formatOuraSyncSummary(
        {
          records: 1,
          sensitiveRecords: 1,
          startDate: "2026-07-24",
          endDate: "2026-07-30",
          warnings: [],
        },
        { operation: "Backfill", includeRange: true }
      )
    ).toBe(
      "Backfill complete (2026-07-24 to 2026-07-30): processed 1 core record and 1 private record."
    );
  });

  it("deduplicates repeated dataset warnings", () => {
    expect(
      formatOuraSyncSummary(
        {
          records: 2,
          sensitiveRecords: 0,
          warnings: [
            { dataset: "heartrate", code: "rate_limited" },
            { dataset: "heartrate", code: "unexpected_error" },
          ],
        },
        { operation: "Sync" }
      )
    ).toBe(
      "Sync complete with partial coverage: processed 2 core records and 0 private records. Optional datasets not fully updated: Heart Rate. The sync did not delete previously stored source rows for those datasets."
    );
  });

  it("does not turn malformed response values into confident zero counts", () => {
    expect(
      formatOuraSyncSummary(
        {
          records: "44",
          status: "partial",
          warnings: [{ code: "unexpected_error" }, null],
        },
        { operation: "Sync" }
      )
    ).toBe(
      "Sync complete with partial coverage: processed core record count unavailable and private record count unavailable. Some optional datasets were not fully updated. The sync did not delete previously stored source rows for those datasets."
    );
  });
});

describe("Sync now message", () => {
  const TODAY = "2026-10-02";
  const syncedAt = Date.parse("2026-10-02T11:42:00Z") / 1000;
  const say = (
    result: unknown,
    latestBefore: string | null,
    latestAfter: string | null
  ) =>
    formatSyncNowResult(result, {
      latestBefore,
      latestAfter,
      syncedAt,
      today: TODAY,
    });
  const clean = {
    status: "success",
    records: 44,
    sensitiveRecords: 2,
    warnings: [],
    failedSteps: [],
  };

  it("says when it synced when a newer night arrived", () => {
    expect(say(clean, "2026-09-30", "2026-10-02")).toBe("Synced 7:42 AM.");
    expect(say(clean, "2026-09-29", "2026-09-30")).toBe("Synced 7:42 AM.");
  });

  it("does not claim nothing was newer once last night is here", () => {
    expect(say(clean, "2026-10-02", "2026-10-02")).toBe("Synced 7:42 AM.");
  });

  it("says Oura had nothing newer than the night on the page", () => {
    expect(say(clean, "2026-09-30", "2026-09-30")).toBe(
      "Synced. Oura had nothing newer than Sep 29 → Sep 30."
    );
    expect(say(clean, "2026-09-30", "2026-09-30")).not.toMatch(/up to date/i);
  });

  it("never names a night it does not know", () => {
    expect(say(clean, null, null)).toBe("Synced 7:42 AM.");
    expect(say(clean, "2026-09-30", null)).toBe("Synced 7:42 AM.");
    expect(say(null, null, null)).toBe("Synced 7:42 AM.");
    expect(say("ok", "2026-09-30", "2026-10-02")).toBe("Synced 7:42 AM.");
  });

  it("adds the date when the sync finished on another day", () => {
    expect(
      formatSyncNowResult(clean, {
        latestBefore: "2026-09-30",
        latestAfter: "2026-10-02",
        syncedAt: Date.parse("2026-10-01T21:01:00Z") / 1000,
        today: TODAY,
      })
    ).toBe("Synced Oct 1, 5:01 PM.");
  });

  it("says what Oura did not share and points to Settings", () => {
    expect(
      say(
        {
          ...clean,
          status: "partial",
          warnings: [{ dataset: "heartrate", code: "not_granted" }],
        },
        "2026-09-30",
        "2026-10-02"
      )
    ).toBe("Synced 7:42 AM, but Oura didn't share Heart Rate. See Settings.");
    expect(
      say(
        {
          ...clean,
          status: "partial",
          warnings: [
            { dataset: "daily_resilience", code: "not_granted" },
            { dataset: "daily_spo2", code: "not_granted" },
          ],
        },
        "2026-09-30",
        "2026-10-02"
      )
    ).toBe(
      "Synced 7:42 AM, but Oura didn't share Resilience and Blood Oxygen. See Settings."
    );
  });

  it("tells data that failed to update and steps that did not finish apart from data Oura withheld", () => {
    expect(
      say(
        {
          ...clean,
          status: "partial",
          warnings: [{ dataset: "heartrate", code: "rate_limited" }],
        },
        "2026-09-30",
        "2026-10-02"
      )
    ).toBe("Synced 7:42 AM, but Heart Rate didn't fully update. See Settings.");
    expect(
      say(
        {
          ...clean,
          status: "partial",
          failedSteps: [{ step: "pattern_checks", message: "x" }],
        },
        "2026-09-30",
        "2026-10-02"
      )
    ).toBe("Synced 7:42 AM, but pattern checks didn't finish. See Settings.");
    expect(
      say(
        {
          ...clean,
          status: "partial",
          warnings: [{ dataset: "vO2_max", code: "not_granted" }],
          failedSteps: [{ step: "health_signals", message: "x" }],
        },
        "2026-09-30",
        "2026-10-02"
      )
    ).toBe(
      "Synced 7:42 AM, but Oura didn't share VO₂ max and health signals didn't finish. See Settings."
    );
  });

  it("still says it was partial when nothing in it is named", () => {
    expect(say({ ...clean, status: "partial" }, "2026-09-30", "2026-10-02")).toBe(
      "Synced 7:42 AM, but some optional data didn't fully update. See Settings."
    );
  });

  it("reports both a gap and nothing newer", () => {
    expect(
      say(
        {
          ...clean,
          status: "partial",
          warnings: [{ dataset: "heartrate", code: "not_granted" }],
        },
        "2026-09-30",
        "2026-09-30"
      )
    ).toBe(
      "Synced. Oura had nothing newer than Sep 29 → Sep 30. Oura didn't share Heart Rate. See Settings."
    );
    expect(
      say(
        {
          ...clean,
          status: "partial",
          failedSteps: [{ step: "pattern_checks", message: "x" }],
        },
        "2026-09-30",
        "2026-09-30"
      )
    ).toBe(
      "Synced. Oura had nothing newer than Sep 29 → Sep 30. Pattern checks didn't finish. See Settings."
    );
  });

  it("sends a rejected connection to Settings and any other failure to a retry", () => {
    const reconnect = "Oura rejected the connection. Reconnect it in Settings.";
    expect(formatSyncNowFailure("Oura token_refresh failed")).toBe(reconnect);
    expect(
      formatSyncNowFailure("Oura request failed for sleep with HTTP 401")
    ).toBe(reconnect);
    expect(
      formatSyncNowFailure("Oura did not grant the daily scope; reconnect Oura")
    ).toBe(reconnect);

    const retry = "Sync didn't finish. Try again in a minute.";
    expect(formatSyncNowFailure("Unauthorized")).toBe(retry);
    expect(formatSyncNowFailure(undefined)).toBe(retry);
    expect(formatSyncNowFailure({ message: "HTTP 401" })).toBe(retry);
  });
});
