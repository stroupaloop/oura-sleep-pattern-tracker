import { beforeEach, describe, expect, it, vi } from "vitest";

import { OuraRequestError } from "./contracts";

const mocks = vi.hoisted(() => ({
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  insert: vi.fn(),
  ouraFetch: vi.fn(),
  ouraFetchSingle: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: mocks.insert.mockImplementation((table: unknown) => ({
      values: (values: unknown) => {
        mocks.inserts.push({ table, values });
        return {
          onConflictDoUpdate: async () => undefined,
        };
      },
    })),
  },
}));

vi.mock("./client", () => ({
  ouraFetch: mocks.ouraFetch,
  ouraFetchSingle: mocks.ouraFetchSingle,
}));

beforeEach(() => {
  mocks.inserts.length = 0;
  mocks.insert.mockClear();
  mocks.ouraFetch.mockReset().mockImplementation(async (endpoint: string) => {
    if (endpoint === "v2/usercollection/daily_activity") {
      return [{ id: "activity", day: "2026-07-30" }];
    }
    if (endpoint === "v2/usercollection/daily_stress") {
      return [{ id: "stress", day: "2026-07-30" }];
    }
    if (endpoint === "v2/usercollection/daily_resilience") {
      throw new OuraRequestError(401, endpoint);
    }
    return [];
  });
  mocks.ouraFetchSingle.mockReset();
});

describe("Oura daily sync", () => {
  it("keeps core writes and reports a partial sync for resilience-only 401", async () => {
    const { dailyActivity, dailyResilience, dailyStress, syncLog } =
      await import("@/lib/db/schema");
    const { syncDateRange } = await import("./sync");

    await expect(
      syncDateRange("2026-07-24", "2026-07-30", "backfill")
    ).resolves.toEqual({
      success: true,
      status: "partial",
      records: 2,
      warnings: [{ dataset: "daily_resilience", code: "unauthorized" }],
    });

    expect(mocks.ouraFetch).toHaveBeenCalledWith(
      "v2/usercollection/daily_resilience",
      { start_date: "2026-07-24", end_date: "2026-07-30" },
      { refreshUnauthorized: false }
    );
    expect(mocks.inserts.some(({ table }) => table === dailyActivity)).toBe(true);
    expect(mocks.inserts.some(({ table }) => table === dailyStress)).toBe(true);
    expect(mocks.inserts.some(({ table }) => table === dailyResilience)).toBe(
      false
    );
    expect(
      mocks.inserts.find(({ table }) => table === syncLog)?.values
    ).toMatchObject({
      recordsFetched: 2,
      status: "partial",
      errorMessage: "daily_resilience:unauthorized",
    });
  });

  it("keeps required endpoint authorization failures fatal", async () => {
    mocks.ouraFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint === "v2/usercollection/daily_readiness") {
        throw new OuraRequestError(401, endpoint);
      }
      return [];
    });
    const { syncLog } = await import("@/lib/db/schema");
    const { syncDateRange } = await import("./sync");

    await expect(
      syncDateRange("2026-07-24", "2026-07-30", "backfill")
    ).rejects.toMatchObject({
      name: "OuraRequestError",
      status: 401,
      operation: "v2/usercollection/daily_readiness",
    });
    expect(
      mocks.ouraFetch.mock.calls.some(
        ([endpoint]) => endpoint === "v2/usercollection/daily_resilience"
      )
    ).toBe(false);
    expect(
      mocks.inserts.find(({ table }) => table === syncLog)?.values
    ).toMatchObject({
      recordsFetched: 0,
      status: "error",
    });
  });

  it("writes resilience normally when Oura returns it", async () => {
    mocks.ouraFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint === "v2/usercollection/daily_resilience") {
        return [
          {
            id: "resilience",
            day: "2026-07-30",
            level: "solid",
            contributors: {
              sleep_recovery: "adequate",
              daytime_recovery: "adequate",
              stress: "adequate",
            },
          },
        ];
      }
      return [];
    });
    const { dailyResilience, syncLog } = await import("@/lib/db/schema");
    const { syncDateRange } = await import("./sync");

    await expect(
      syncDateRange("2026-07-24", "2026-07-30", "backfill")
    ).resolves.toEqual({
      success: true,
      status: "success",
      records: 1,
      warnings: [],
    });
    expect(mocks.inserts.some(({ table }) => table === dailyResilience)).toBe(
      true
    );
    expect(
      mocks.inserts.find(({ table }) => table === syncLog)?.values
    ).toMatchObject({
      recordsFetched: 1,
      status: "success",
      errorMessage: null,
    });
  });
});
