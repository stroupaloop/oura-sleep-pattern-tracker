import { beforeEach, describe, expect, it, vi } from "vitest";
import { OuraContractError, OuraRequestError } from "./contracts";

const mocks = vi.hoisted(() => ({
  ouraFetch: vi.fn(),
  upsertHeartRateBuckets: vi.fn(),
}));

vi.mock("./client", () => ({ ouraFetch: mocks.ouraFetch }));
vi.mock("./heartrate-store", () => ({
  upsertHeartRateBuckets: mocks.upsertHeartRateBuckets,
}));

function sampleAt(params: Record<string, string>) {
  return [{ bpm: 60, source: "rest", timestamp: params.start_datetime }];
}

const pause = vi.fn(async () => {});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  pause.mockClear();
  mocks.upsertHeartRateBuckets.mockReset().mockResolvedValue(undefined);
  mocks.ouraFetch
    .mockReset()
    .mockImplementation(async (_endpoint: string, params: Record<string, string>) =>
      sampleAt(params)
    );
});

describe("syncHeartRateWindows", () => {
  it("stores a 90-day range window by window", async () => {
    const { syncHeartRateWindows } = await import("./heartrate-sync");

    const result = await syncHeartRateWindows("2026-07-05", "2026-10-02", 1, pause);

    expect(mocks.ouraFetch).toHaveBeenCalledTimes(7);
    expect(mocks.upsertHeartRateBuckets).toHaveBeenCalledTimes(7);
    expect(result).toMatchObject({
      days: 7,
      samples: 7,
      skippedSamples: 0,
      failedWindows: [],
      warning: null,
    });
    expect(pause).not.toHaveBeenCalled();
  });

  it("retries a passing database or network hiccup before giving up on a window", async () => {
    mocks.upsertHeartRateBuckets
      .mockRejectedValueOnce(new Error("Failed query: insert into daily_heartrate"))
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    const { syncHeartRateWindows } = await import("./heartrate-sync");

    const result = await syncHeartRateWindows("2026-09-01", "2026-09-10", 1, pause);

    expect(result.failedWindows).toEqual([]);
    expect(result.warning).toBeNull();
    expect(pause.mock.calls).toEqual([[1_000], [3_000]]);
  });

  it("keeps the other windows when one keeps failing", async () => {
    mocks.ouraFetch.mockImplementation(
      async (_endpoint: string, params: Record<string, string>) => {
        if (params.start_datetime.startsWith("2026-09-0")) {
          throw new OuraRequestError(503, "v2/usercollection/heartrate");
        }
        return sampleAt(params);
      }
    );
    const { syncHeartRateWindows } = await import("./heartrate-sync");

    const result = await syncHeartRateWindows("2026-08-19", "2026-09-29", 1, pause);

    expect(result.failedWindows).toEqual([
      { startDay: "2026-09-02", endDay: "2026-09-15" },
    ]);
    expect(result.days).toBe(2);
    expect(result.warning).toEqual({ dataset: "heartrate", code: "upstream_error" });
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it("does not retry what a retry cannot fix", async () => {
    mocks.ouraFetch.mockRejectedValue(
      new OuraRequestError(401, "v2/usercollection/heartrate")
    );
    const { syncHeartRateWindows } = await import("./heartrate-sync");

    const result = await syncHeartRateWindows("2026-09-01", "2026-09-02", 1, pause);

    expect(mocks.ouraFetch).toHaveBeenCalledTimes(1);
    expect(pause).not.toHaveBeenCalled();
    expect(result.warning).toEqual({ dataset: "heartrate", code: "unauthorized" });
  });
});

describe("isRetryableHeartRateError", () => {
  it("retries rate limits, outages and unknown failures only", async () => {
    const { isRetryableHeartRateError } = await import("./heartrate-sync");
    expect(isRetryableHeartRateError(new OuraRequestError(429, "x"))).toBe(true);
    expect(isRetryableHeartRateError(new OuraRequestError(502, "x"))).toBe(true);
    expect(isRetryableHeartRateError(new OuraRequestError(400, "x"))).toBe(false);
    expect(isRetryableHeartRateError(new OuraRequestError(403, "x"))).toBe(false);
    expect(isRetryableHeartRateError(new OuraContractError("x"))).toBe(false);
    expect(isRetryableHeartRateError(new Error("Failed query"))).toBe(true);
  });
});
