import { beforeEach, describe, expect, it, vi } from "vitest";

import { OuraRequestError } from "./contracts";

const mocks = vi.hoisted(() => ({
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  insert: vi.fn(),
  ouraFetch: vi.fn(),
  ouraFetchSingle: vi.fn(),
  loadOuraGrant: vi.fn(),
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
  loadOuraGrant: mocks.loadOuraGrant,
}));

/** What production's connection was granted on 2026-10-01. */
const PRODUCTION_GRANT = new Set([
  "email",
  "personal",
  "daily",
  "heartrate",
  "workout",
  "tag",
  "session",
]);

beforeEach(() => {
  mocks.inserts.length = 0;
  mocks.insert.mockClear();
  mocks.ouraFetch.mockReset().mockImplementation(async (endpoint: string) => {
    if (endpoint === "v2/usercollection/daily_activity") {
      return [
        {
          id: "activity",
          day: "2026-07-30",
          timestamp: "2026-07-30T04:00:00-04:00",
          met: {
            timestamp: "2026-07-30T04:00:00-04:00",
            interval: 60,
            items: [],
          },
        },
      ];
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
  mocks.loadOuraGrant.mockReset().mockResolvedValue(null);
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
      { start_date: "2026-07-24", end_date: "2026-07-31" },
      { refreshUnauthorized: false }
    );
    expect(mocks.inserts.some(({ table }) => table === dailyActivity)).toBe(true);
    expect(
      mocks.inserts.find(({ table }) => table === dailyActivity)?.values
    ).toMatchObject({
      met: JSON.stringify({
        timestamp: "2026-07-30T04:00:00-04:00",
        interval: 60,
        items: [],
        activity_timestamp: "2026-07-30T04:00:00-04:00",
      }),
    });
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

describe("Oura daily sync requests", () => {
  it("asks for the day after end_date so last night arrives the same morning", async () => {
    const { syncDateRange } = await import("./sync");

    await syncDateRange("2026-09-25", "2026-10-01", "cron");

    for (const endpoint of [
      "v2/usercollection/sleep",
      "v2/usercollection/daily_sleep",
      "v2/usercollection/daily_readiness",
      "v2/usercollection/daily_activity",
      "v2/usercollection/daily_stress",
    ]) {
      expect(mocks.ouraFetch).toHaveBeenCalledWith(endpoint, {
        start_date: "2026-09-25",
        end_date: "2026-10-02",
      });
    }
  });

  it("never spends a token refresh on an optional dataset", async () => {
    const { syncDateRange } = await import("./sync");

    await syncDateRange("2026-09-25", "2026-10-01", "cron");

    const optionalCalls = mocks.ouraFetch.mock.calls.filter(([endpoint]) =>
      [
        "v2/usercollection/daily_resilience",
        "v2/usercollection/daily_spo2",
        "v2/usercollection/workout",
        "v2/usercollection/session",
        "v2/usercollection/heartrate",
      ].includes(endpoint)
    );
    expect(optionalCalls).toHaveLength(5);
    for (const call of optionalCalls) {
      expect(call[2]).toEqual({ refreshUnauthorized: false });
    }
  });

  it("skips datasets the grant does not cover instead of asking Oura", async () => {
    mocks.loadOuraGrant.mockResolvedValue(PRODUCTION_GRANT);
    const { dailyResilience, dailySpo2, syncLog } = await import(
      "@/lib/db/schema"
    );
    const { syncDateRange } = await import("./sync");

    const result = await syncDateRange("2026-09-25", "2026-10-01", "cron");

    expect(result.status).toBe("partial");
    expect(result.warnings).toEqual([
      { dataset: "daily_resilience", code: "not_granted" },
      { dataset: "daily_spo2", code: "not_granted" },
    ]);
    const requested = mocks.ouraFetch.mock.calls.map(([endpoint]) => endpoint);
    expect(requested).not.toContain("v2/usercollection/daily_resilience");
    expect(requested).not.toContain("v2/usercollection/daily_spo2");
    expect(requested).toContain("v2/usercollection/workout");
    expect(mocks.inserts.some(({ table }) => table === dailyResilience)).toBe(
      false
    );
    expect(mocks.inserts.some(({ table }) => table === dailySpo2)).toBe(false);
    expect(
      mocks.inserts.find(({ table }) => table === syncLog)?.values
    ).toMatchObject({
      status: "partial",
      errorMessage: "daily_resilience:not_granted,daily_spo2:not_granted",
    });
  });

  it("fails before any request when the daily scope is missing", async () => {
    mocks.loadOuraGrant.mockResolvedValue(new Set(["email", "personal"]));
    const { syncLog } = await import("@/lib/db/schema");
    const { syncDateRange } = await import("./sync");

    await expect(
      syncDateRange("2026-09-25", "2026-10-01", "cron")
    ).rejects.toThrow(/daily scope/);
    expect(mocks.ouraFetch).not.toHaveBeenCalled();
    expect(
      mocks.inserts.find(({ table }) => table === syncLog)?.values
    ).toMatchObject({ status: "error" });
  });

  it("asks for a long heart-rate backfill in windows Oura accepts", async () => {
    mocks.ouraFetch.mockImplementation(
      async (endpoint: string, params: Record<string, string>) => {
        if (endpoint !== "v2/usercollection/heartrate") return [];
        return [
          { bpm: 60, source: "rest", timestamp: params.start_datetime },
        ];
      }
    );
    const { dailyHeartrate } = await import("@/lib/db/schema");
    const { syncDateRange } = await import("./sync");

    await syncDateRange("2026-07-04", "2026-10-01", "backfill");

    const windows = mocks.ouraFetch.mock.calls
      .filter(([endpoint]) => endpoint === "v2/usercollection/heartrate")
      .map(([, params]) => params as Record<string, string>);
    expect(windows).toHaveLength(7);
    expect(windows[0].start_datetime).toBe("2026-07-04T04:00:00.000Z");
    expect(windows.at(-1)?.end_datetime).toBe("2026-10-02T03:59:59.000Z");
    for (const window of windows) {
      const span =
        Date.parse(window.end_datetime) - Date.parse(window.start_datetime);
      expect(span).toBeLessThan(30 * 86_400_000);
    }
    const dailyWrites = mocks.inserts.filter(
      ({ table }) => table === dailyHeartrate
    );
    expect(dailyWrites).toHaveLength(1);
    expect(dailyWrites[0].values).toHaveLength(7);
  });

  it("stores a sleep period Oura left untyped instead of failing the sync", async () => {
    mocks.ouraFetch.mockImplementation(async (endpoint: string) => {
      if (endpoint !== "v2/usercollection/sleep") return [];
      return [
        {
          id: "untyped",
          day: "2026-10-01",
          type: null,
          bedtime_start: "2026-10-01T00:10:00-04:00",
          bedtime_end: "2026-10-01T06:00:00-04:00",
          heart_rate: null,
          hrv: null,
        },
      ];
    });
    const { sleepPeriods } = await import("@/lib/db/schema");
    const { syncDateRange } = await import("./sync");

    await syncDateRange("2026-09-25", "2026-10-01", "cron");

    expect(
      mocks.inserts.find(({ table }) => table === sleepPeriods)?.values
    ).toMatchObject({ id: "untyped", type: "unknown" });
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
        { start_date: "2026-07-24", end_date: "2026-07-31" },
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
              day_tz: -7 * 3600,
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
      mocks.inserts.find(({ table }) => table === sleepTime)?.values
    ).toMatchObject({
      optimalBedtimeStart:
        '{"v":1,"day_tz":-25200,"offset":-3600}',
      optimalBedtimeEnd: '{"v":1,"day_tz":-25200,"offset":0}',
    });
    expect(
      mocks.inserts.find(({ table }) => table === syncLog)?.values
    ).toMatchObject({
      syncType: "backfill-sensitive",
      recordsFetched: 5,
      status: "success",
      errorMessage: null,
    });
  });

  it("skips profile and heart-health data the grant does not cover", async () => {
    mocks.loadOuraGrant.mockResolvedValue(new Set(["daily", "tag"]));
    const { personalInfo } = await import("@/lib/db/schema");
    const { syncSensitiveDateRange } = await import("./sync");

    const result = await syncSensitiveDateRange(
      "2026-09-25",
      "2026-10-01",
      "cron"
    );

    expect(result.warnings).toEqual([
      { dataset: "personal_info", code: "not_granted" },
      { dataset: "daily_cardiovascular_age", code: "not_granted" },
      { dataset: "vO2_max", code: "not_granted" },
    ]);
    expect(mocks.ouraFetchSingle).not.toHaveBeenCalled();
    expect(
      mocks.ouraFetch.mock.calls.map(([endpoint]) => endpoint)
    ).not.toContain("v2/usercollection/vO2_max");
    expect(mocks.inserts.some(({ table }) => table === personalInfo)).toBe(
      false
    );
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
