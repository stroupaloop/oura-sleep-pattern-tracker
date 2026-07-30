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

describe("Oura sensitive sync", () => {
  it("keeps required writes and reports unavailable fitness sources as partial", async () => {
    mocks.ouraFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint === "v2/usercollection/rest_mode_period") {
        return [
          {
            id: "rest-mode",
            start_day: "2026-07-30",
            end_day: null,
            start_time: null,
            end_time: null,
            episodes: null,
          },
        ];
      }
      if (
        endpoint === "v2/usercollection/daily_cardiovascular_age" ||
        endpoint === "v2/usercollection/vO2_max" ||
        endpoint === "v2/usercollection/sleep_time"
      ) {
        throw new OuraRequestError(401, endpoint);
      }
      return [];
    });
    mocks.ouraFetchSingle.mockResolvedValue({
      id: "personal-info",
      age: 30,
      weight: 70,
      height: 170,
      biological_sex: "female",
      email: "person@example.test",
    });
    const {
      dailyCardiovascularAge,
      personalInfo,
      restModePeriods,
      sleepTime,
      syncLog,
      vo2Max,
    } = await import("@/lib/db/schema");
    const { syncSensitiveDateRange } = await import("./sync");

    await expect(
      syncSensitiveDateRange("2026-07-24", "2026-07-30", "backfill")
    ).resolves.toEqual({
      success: true,
      status: "partial",
      records: 2,
      warnings: [
        { dataset: "daily_cardiovascular_age", code: "unauthorized" },
        { dataset: "vO2_max", code: "unauthorized" },
        { dataset: "sleep_time", code: "unauthorized" },
      ],
    });

    for (const endpoint of [
      "v2/usercollection/enhanced_tag",
      "v2/usercollection/daily_cardiovascular_age",
      "v2/usercollection/vO2_max",
      "v2/usercollection/sleep_time",
    ]) {
      expect(mocks.ouraFetch).toHaveBeenCalledWith(
        endpoint,
        { start_date: "2026-07-24", end_date: "2026-07-30" },
        { refreshUnauthorized: false }
      );
    }
    expect(mocks.inserts.some(({ table }) => table === restModePeriods)).toBe(
      true
    );
    expect(mocks.inserts.some(({ table }) => table === personalInfo)).toBe(true);
    expect(
      mocks.inserts.some(({ table }) => table === dailyCardiovascularAge)
    ).toBe(false);
    expect(mocks.inserts.some(({ table }) => table === vo2Max)).toBe(false);
    expect(mocks.inserts.some(({ table }) => table === sleepTime)).toBe(false);
    expect(
      mocks.inserts.find(({ table }) => table === syncLog)?.values
    ).toMatchObject({
      syncType: "backfill-sensitive",
      recordsFetched: 2,
      status: "partial",
      errorMessage:
        "daily_cardiovascular_age:unauthorized,vO2_max:unauthorized,sleep_time:unauthorized",
    });
  });

  it("writes fitness sources normally when Oura returns them", async () => {
    mocks.ouraFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint === "v2/usercollection/rest_mode_period") {
        return [
          {
            id: "rest-mode",
            start_day: "2026-07-30",
            end_day: null,
            start_time: null,
            end_time: null,
            episodes: null,
          },
        ];
      }
      if (endpoint === "v2/usercollection/daily_cardiovascular_age") {
        return [{ day: "2026-07-30", vascular_age: 28 }];
      }
      if (endpoint === "v2/usercollection/vO2_max") {
        return [{ id: "vo2", day: "2026-07-30", vo2_max: 42 }];
      }
      if (endpoint === "v2/usercollection/sleep_time") {
        return [
          {
            id: "sleep-time",
            day: "2026-07-30",
            optimal_bedtime: {
              start_offset: -3600,
              end_offset: 0,
            },
            recommendation: "recommended",
            status: "optimal",
          },
        ];
      }
      return [];
    });
    mocks.ouraFetchSingle.mockResolvedValue({
      id: "personal-info",
      age: 30,
      weight: 70,
      height: 170,
      biological_sex: "female",
      email: "person@example.test",
    });
    const {
      dailyCardiovascularAge,
      personalInfo,
      restModePeriods,
      sleepTime,
      syncLog,
      vo2Max,
    } = await import("@/lib/db/schema");
    const { syncSensitiveDateRange } = await import("./sync");

    await expect(
      syncSensitiveDateRange("2026-07-24", "2026-07-30", "backfill")
    ).resolves.toEqual({
      success: true,
      status: "success",
      records: 5,
      warnings: [],
    });
    for (const table of [
      restModePeriods,
      personalInfo,
      dailyCardiovascularAge,
      vo2Max,
      sleepTime,
    ]) {
      expect(mocks.inserts.some((insert) => insert.table === table)).toBe(true);
    }
    expect(
      mocks.inserts.find(({ table }) => table === syncLog)?.values
    ).toMatchObject({
      syncType: "backfill-sensitive",
      recordsFetched: 5,
      status: "success",
      errorMessage: null,
    });
  });

  it("keeps rest-mode authorization failures fatal", async () => {
    mocks.ouraFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint === "v2/usercollection/rest_mode_period") {
        throw new OuraRequestError(401, endpoint);
      }
      return [];
    });
    mocks.ouraFetchSingle.mockResolvedValue({
      id: "personal-info",
      age: null,
      weight: null,
      height: null,
      biological_sex: null,
      email: null,
    });
    const { syncLog } = await import("@/lib/db/schema");
    const { syncSensitiveDateRange } = await import("./sync");

    await expect(
      syncSensitiveDateRange("2026-07-24", "2026-07-30", "backfill")
    ).rejects.toMatchObject({
      name: "OuraRequestError",
      status: 401,
      operation: "v2/usercollection/rest_mode_period",
    });
    expect(
      mocks.ouraFetch.mock.calls.some(
        ([endpoint]) =>
          endpoint === "v2/usercollection/daily_cardiovascular_age"
      )
    ).toBe(false);
    expect(
      mocks.inserts.find(({ table }) => table === syncLog)?.values
    ).toMatchObject({
      syncType: "backfill-sensitive",
      recordsFetched: 0,
      status: "error",
    });
  });
});
