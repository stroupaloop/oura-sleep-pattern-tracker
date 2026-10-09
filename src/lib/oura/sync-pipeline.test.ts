import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  calls: [] as string[],
  syncDateRange: vi.fn(),
  syncSensitiveDateRange: vi.fn(),
  runCyclePredictions: vi.fn(),
  runHealthSignalDetection: vi.fn(),
  reprocessAll: vi.fn(),
  hasOutdatedPatternResults: vi.fn(),
  renewOuraTokenIfDue: vi.fn(),
}));

vi.mock("./client", () => ({
  renewOuraTokenIfDue: mocks.renewOuraTokenIfDue,
}));

vi.mock("./sync", () => ({
  syncDateRange: mocks.syncDateRange,
  syncSensitiveDateRange: mocks.syncSensitiveDateRange,
}));
vi.mock("@/lib/analysis/cycle", () => ({
  runCyclePredictions: mocks.runCyclePredictions,
}));
vi.mock("@/lib/analysis/health-signals", () => ({
  runHealthSignalDetection: mocks.runHealthSignalDetection,
}));
vi.mock("@/lib/analysis/reprocess", () => ({
  reprocessAll: mocks.reprocessAll,
}));
vi.mock("@/lib/analysis/outdated-results", () => ({
  hasOutdatedPatternResults: mocks.hasOutdatedPatternResults,
}));
vi.mock("@/lib/analysis/config", () => ({
  loadActiveConfig: async () => ({ version: 1 }),
  loadBipolarType: async () => "unspecified",
}));

const EVALUATION = { status: "evaluated" };
const ANALYSIS = {
  daysProcessed: 412,
  episodes: { watch: 1, warning: 0, alert: 0 },
  processingTimeMs: 900,
};

function track<T>(name: string, value: T) {
  return async () => {
    mocks.calls.push(name);
    return value;
  };
}

function fail(name: string) {
  return async () => {
    mocks.calls.push(name);
    throw new Error(`${name} broke`);
  };
}

beforeEach(() => {
  mocks.calls.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.renewOuraTokenIfDue
    .mockReset()
    .mockImplementation(track("renew", "not_due"));
  mocks.syncDateRange
    .mockReset()
    .mockImplementation(
      track("core", { success: true, status: "success", records: 448, warnings: [] })
    );
  mocks.syncSensitiveDateRange
    .mockReset()
    .mockImplementation(
      track("private", {
        success: true,
        status: "partial",
        records: 66,
        warnings: [{ dataset: "vO2_max", code: "not_granted" }],
      })
    );
  mocks.runCyclePredictions
    .mockReset()
    .mockImplementation(track("cycles", { cyclesDetected: 3, evaluation: EVALUATION }));
  mocks.reprocessAll.mockReset().mockImplementation(track("analysis", ANALYSIS));
  mocks.hasOutdatedPatternResults.mockReset().mockResolvedValue(false);
  mocks.runHealthSignalDetection
    .mockReset()
    .mockImplementation(track("signals", { signals: 2, resolved: 0 }));
});

const BACKFILL = {
  startDate: "2026-07-05",
  endDate: "2026-10-02",
  syncType: "backfill" as const,
  includePrivate: true,
  recompute: "history" as const,
};

describe("runOuraSyncPipeline", () => {
  it("syncs, then recomputes everything that depends on the new data", async () => {
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    const result = await runOuraSyncPipeline(BACKFILL);

    expect(mocks.calls).toEqual(["renew", "core", "private", "cycles", "analysis", "signals"]);
    expect(mocks.syncDateRange).toHaveBeenCalledWith(
      "2026-07-05",
      "2026-10-02",
      "backfill"
    );
    expect(mocks.runHealthSignalDetection).toHaveBeenCalledWith(EVALUATION);
    expect(result).toMatchObject({
      status: "partial",
      records: 448,
      sensitiveRecords: 66,
      warnings: [{ dataset: "vO2_max", code: "not_granted" }],
      failedSteps: [],
      cyclesDetected: 3,
      analysis: ANALYSIS,
      healthSignals: 2,
    });
  });

  it("recomputes all history for a backfill and only the window otherwise", async () => {
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    await runOuraSyncPipeline(BACKFILL);
    expect(mocks.reprocessAll.mock.calls[0][1]).toBeUndefined();
    expect(mocks.reprocessAll.mock.calls[0][2]).toBe("2026-10-02");

    await runOuraSyncPipeline({ ...BACKFILL, syncType: "cron", recompute: "window" });
    expect(mocks.reprocessAll.mock.calls[1][1]).toBe("2026-07-05");
  });

  it("recomputes all history on a window sync once stored results are out of date", async () => {
    mocks.hasOutdatedPatternResults.mockResolvedValue(true);
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    await runOuraSyncPipeline({ ...BACKFILL, syncType: "cron", recompute: "window" });

    expect(mocks.hasOutdatedPatternResults).toHaveBeenCalledWith(1, "unspecified");
    expect(mocks.reprocessAll.mock.calls[0][1]).toBeUndefined();
    expect(mocks.reprocessAll.mock.calls[0][2]).toBe("2026-10-02");
  });

  it("keeps a window sync to its window while stored results are current", async () => {
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    await runOuraSyncPipeline({ ...BACKFILL, syncType: "cron", recompute: "window" });

    expect(mocks.reprocessAll.mock.calls[0][1]).toBe("2026-07-05");
  });

  it("does not look at stored results when the whole history was asked for", async () => {
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    await runOuraSyncPipeline(BACKFILL);

    expect(mocks.hasOutdatedPatternResults).not.toHaveBeenCalled();
    expect(mocks.reprocessAll.mock.calls[0][1]).toBeUndefined();
  });

  it("reports a failed check of stored results like any failed pattern step, and still finishes", async () => {
    mocks.hasOutdatedPatternResults.mockRejectedValue(new Error("check broke"));
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    const result = await runOuraSyncPipeline({
      ...BACKFILL,
      syncType: "cron",
      recompute: "window",
    });

    expect(result.failedSteps).toEqual([
      { step: "pattern_checks", message: "check broke" },
    ]);
    expect(mocks.calls).toContain("signals");
  });

  it("still recomputes the pattern checks when the private sync fails", async () => {
    mocks.syncSensitiveDateRange.mockImplementation(fail("private"));
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    const result = await runOuraSyncPipeline(BACKFILL);

    expect(mocks.calls).toEqual(["renew", "core", "private", "cycles", "analysis", "signals"]);
    expect(result.status).toBe("partial");
    expect(result.failedSteps).toEqual([
      { step: "private_sync", message: "private broke" },
    ]);
    expect(result.analysis).toEqual(ANALYSIS);
  });

  it("skips health signals without a cycle evaluation but keeps the analysis", async () => {
    mocks.runCyclePredictions.mockImplementation(fail("cycles"));
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    const result = await runOuraSyncPipeline(BACKFILL);

    expect(mocks.calls).toEqual(["renew", "core", "private", "cycles", "analysis"]);
    expect(result.failedSteps.map((failure) => failure.step)).toEqual([
      "cycle_predictions",
    ]);
    expect(result.healthSignals).toBe(0);
  });

  it("reports a failed recompute and still refreshes health signals", async () => {
    mocks.reprocessAll.mockImplementation(fail("analysis"));
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    const result = await runOuraSyncPipeline(BACKFILL);

    expect(mocks.calls).toEqual(["renew", "core", "private", "cycles", "analysis", "signals"]);
    expect(result.analysis).toBeNull();
    expect(result.failedSteps.map((failure) => failure.step)).toEqual([
      "pattern_checks",
    ]);
  });

  it("stops when nothing new arrived from Oura", async () => {
    mocks.syncDateRange.mockImplementation(fail("core"));
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    await expect(runOuraSyncPipeline(BACKFILL)).rejects.toThrow("core broke");
    expect(mocks.calls).toEqual(["renew", "core"]);
  });

  it("leaves private data and what depends on it alone when asked to", async () => {
    const { runOuraSyncPipeline } = await import("./sync-pipeline");

    const result = await runOuraSyncPipeline({ ...BACKFILL, includePrivate: false });

    expect(mocks.calls).toEqual(["renew", "core", "analysis"]);
    expect(result.status).toBe("success");
  });
});
