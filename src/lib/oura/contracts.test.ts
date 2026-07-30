import { describe, expect, it } from "vitest";

import {
  OURA_ENDPOINTS,
  OURA_SCOPE,
  OURA_SCOPES,
  OuraContractError,
  OuraRequestError,
  averageOuraTimeSeries,
  fetchOptionalOuraCollection,
  formatOuraSyncWarnings,
  getAppAlignedHypnogram,
  getEnhancedTagDay,
  minimumOuraTimeSeries,
  parseOuraCollectionResponse,
  resolveOuraScope,
  runOptionalOuraTask,
  toOuraSyncWarning,
} from "./contracts";

describe("Oura API contracts", () => {
  it("uses the current scopes and case-sensitive endpoints", () => {
    expect(OURA_SCOPES).toEqual([
      "email",
      "personal",
      "daily",
      "heartrate",
      "workout",
      "tag",
      "session",
      "spo2Daily",
    ]);
    expect(OURA_ENDPOINTS.vo2Max).toBe("v2/usercollection/vO2_max");
    expect(OURA_ENDPOINTS.sleepTime).toBe("v2/usercollection/sleep_time");
    expect(resolveOuraScope("daily tag", undefined)).toBe("daily tag");
    expect(resolveOuraScope(null, "daily")).toBe("daily");
    expect(resolveOuraScope(null, undefined)).toBe(OURA_SCOPE);
  });

  it("parses collection responses and normalizes an omitted next token", () => {
    expect(
      parseOuraCollectionResponse(
        { data: [{ id: "synthetic" }] },
        "endpoint"
      )
    ).toEqual({
      data: [{ id: "synthetic" }],
      next_token: null,
    });
  });

  it("rejects malformed collection responses", () => {
    expect(() =>
      parseOuraCollectionResponse({ data: null }, "endpoint")
    ).toThrow(/Invalid Oura response/);
    expect(() =>
      parseOuraCollectionResponse(
        { data: [], next_token: 123 },
        "endpoint"
      )
    ).toThrow(/Invalid Oura response/);
  });

  it("returns optional data without a warning on success", async () => {
    await expect(
      fetchOptionalOuraCollection("session", async () => [
        { id: "synthetic" },
      ])
    ).resolves.toEqual({
      data: [{ id: "synthetic" }],
      warning: null,
    });
  });

  it("turns optional request failures into privacy-safe warnings", async () => {
    const result = await fetchOptionalOuraCollection(
      "daily_spo2",
      async () => {
        throw new OuraRequestError(403, "private-operation-detail");
      }
    );

    expect(result).toEqual({
      data: [],
      warning: { dataset: "daily_spo2", code: "forbidden" },
    });
    expect(formatOuraSyncWarnings([result.warning!])).toBe(
      "daily_spo2:forbidden"
    );
    expect(formatOuraSyncWarnings([])).toBeNull();
  });

  it("captures optional processing failures without exposing details", async () => {
    await expect(
      runOptionalOuraTask("session", async () => {
        throw new Error("private processing detail");
      })
    ).resolves.toEqual({
      value: null,
      warning: { dataset: "session", code: "unexpected_error" },
    });
  });

  it("classifies optional failures without copying error details", () => {
    expect(
      toOuraSyncWarning(
        "heartrate",
        new OuraRequestError(401, "secret")
      )
    ).toEqual({ dataset: "heartrate", code: "unauthorized" });
    expect(
      toOuraSyncWarning(
        "heartrate",
        new OuraRequestError(429, "secret")
      )
    ).toEqual({ dataset: "heartrate", code: "rate_limited" });
    expect(
      toOuraSyncWarning(
        "heartrate",
        new OuraRequestError(503, "secret")
      )
    ).toEqual({ dataset: "heartrate", code: "upstream_error" });
    expect(
      toOuraSyncWarning("heartrate", new OuraContractError("secret"))
    ).toEqual({ dataset: "heartrate", code: "invalid_response" });
    expect(
      toOuraSyncWarning("heartrate", new Error("secret"))
    ).toEqual({
      dataset: "heartrate",
      code: "unexpected_error",
    });
  });

  it("averages only present finite session samples", () => {
    expect(
      averageOuraTimeSeries({
        interval: 300,
        items: [60, null, 66],
        timestamp: "2026-01-01T00:00:00Z",
      })
    ).toBe(63);
    expect(
      averageOuraTimeSeries({
        interval: 300,
        items: [null],
        timestamp: "2026-01-01T00:00:00Z",
      })
    ).toBeNull();
    expect(
      minimumOuraTimeSeries({
        interval: 300,
        items: [60, null, 54],
        timestamp: "2026-01-01T00:00:00Z",
      })
    ).toBe(54);
  });

  it("maps enhanced tags to their start day with an end-day fallback", () => {
    expect(
      getEnhancedTagDay({
        id: "synthetic",
        start_day: "2026-01-01",
        end_day: "2026-01-02",
      })
    ).toBe("2026-01-01");
    expect(
      getEnhancedTagDay({
        id: "synthetic",
        start_day: null,
        end_day: "2026-01-02",
      })
    ).toBe("2026-01-02");
    expect(() =>
      getEnhancedTagDay({
        id: "synthetic",
        start_day: null,
        end_day: null,
      })
    ).toThrow(/Invalid Oura response/);
  });

  it("prefers the app-aligned hypnogram when Oura provides it", () => {
    expect(
      getAppAlignedHypnogram({
        app_sleep_phase_5_min: "app",
        sleep_phase_5_min: "raw",
      })
    ).toBe("app");
    expect(
      getAppAlignedHypnogram({
        app_sleep_phase_5_min: null,
        sleep_phase_5_min: "raw",
      })
    ).toBe("raw");
  });
});
