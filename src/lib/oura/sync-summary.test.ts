import { describe, expect, it } from "vitest";
import { formatOuraSyncSummary } from "./sync-summary";

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
