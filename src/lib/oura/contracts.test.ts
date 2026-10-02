import { describe, expect, it, vi } from "vitest";

import {
  OURA_DATASET_SCOPES,
  OURA_ENDPOINTS,
  OURA_SCOPE,
  OURA_SCOPES,
  OuraContractError,
  OuraRequestError,
  averageOuraTimeSeries,
  fetchGrantedOuraCollection,
  fetchOptionalOuraCollection,
  isOuraDatasetGranted,
  missingOuraScopes,
  parseGrantedOuraScopes,
  readOAuthErrorCode,
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
      "spo2",
      "stress",
      "heart_health",
    ]);
    expect(OURA_ENDPOINTS.vo2Max).toBe("v2/usercollection/vO2_max");
    expect(OURA_ENDPOINTS.sleepTime).toBe("v2/usercollection/sleep_time");
    expect(resolveOuraScope("daily tag", undefined)).toBe("daily tag");
    expect(resolveOuraScope(null, "daily")).toBe("daily");
    expect(resolveOuraScope(null, undefined)).toBe(OURA_SCOPE);
  });

  it("maps every gated dataset to a scope the app requests", () => {
    for (const scope of Object.values(OURA_DATASET_SCOPES)) {
      expect(OURA_SCOPES).toContain(scope);
    }
    expect(OURA_DATASET_SCOPES.daily_spo2).toBe("spo2");
    expect(OURA_DATASET_SCOPES.daily_resilience).toBe("stress");
    expect(OURA_DATASET_SCOPES.vO2_max).toBe("heart_health");
    expect(OURA_DATASET_SCOPES.daily_cardiovascular_age).toBe("heart_health");
  });

  it("reads Oura's prefixed grant names as the bare scopes the app requests", () => {
    const stored =
      "extapi:email extapi:personal extapi:daily extapi:heartrate extapi:workout extapi:tag extapi:session";

    expect(parseGrantedOuraScopes(stored)).toEqual(
      new Set([
        "email",
        "personal",
        "daily",
        "heartrate",
        "workout",
        "tag",
        "session",
      ])
    );
    expect(parseGrantedOuraScopes("daily  tag")).toEqual(
      new Set(["daily", "tag"])
    );
    expect(parseGrantedOuraScopes("")).toBeNull();
    expect(parseGrantedOuraScopes(null)).toBeNull();
    expect(missingOuraScopes(stored)).toEqual(["spo2", "stress", "heart_health"]);
    expect(missingOuraScopes(OURA_SCOPE)).toEqual([]);
  });

  it("treats an unrecorded grant as covering every dataset", () => {
    expect(isOuraDatasetGranted(null, "daily_spo2")).toBe(true);
    expect(isOuraDatasetGranted(new Set(["daily"]), "daily_stress")).toBe(true);
    expect(isOuraDatasetGranted(new Set(["daily"]), "daily_spo2")).toBe(false);
  });

  it("skips a dataset outside the grant without calling Oura", async () => {
    const fetchCollection = vi.fn(async () => [{ id: "synthetic" }]);

    await expect(
      fetchGrantedOuraCollection(
        new Set(["daily"]),
        "daily_resilience",
        fetchCollection
      )
    ).resolves.toEqual({
      data: [],
      warning: { dataset: "daily_resilience", code: "not_granted" },
    });
    expect(fetchCollection).not.toHaveBeenCalled();

    await expect(
      fetchGrantedOuraCollection(
        new Set(["stress"]),
        "daily_resilience",
        fetchCollection
      )
    ).resolves.toEqual({ data: [{ id: "synthetic" }], warning: null });
  });

  it("names Oura's OAuth error code in token failures", async () => {
    const invalidGrant = new Response(
      JSON.stringify({ error: "invalid_grant", error_description: "x" }),
      { status: 400 }
    );
    const reason = await readOAuthErrorCode(invalidGrant);
    expect(reason).toBe("invalid_grant");
    expect(new OuraRequestError(400, "token_refresh", reason).message).toBe(
      "Oura request failed for token_refresh with HTTP 400 (invalid_grant)"
    );
    expect(new OuraRequestError(400, "token_refresh").message).toBe(
      "Oura request failed for token_refresh with HTTP 400"
    );
    await expect(
      readOAuthErrorCode(new Response("<html>", { status: 502 }))
    ).resolves.toBeNull();
    await expect(
      readOAuthErrorCode(
        new Response(JSON.stringify({ error: "Bad <script>" }), { status: 400 })
      )
    ).resolves.toBeNull();
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
