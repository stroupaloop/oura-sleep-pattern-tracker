import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OuraRequestError } from "./contracts";

type TokenRow = {
  id: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  updatedAt: number;
};

const mocks = vi.hoisted(() => ({
  token: {
    id: 1,
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: Number.MAX_SAFE_INTEGER,
    scope: "daily",
    updatedAt: 1,
  } as TokenRow,
  select: vi.fn(),
  update: vi.fn(),
  refreshAccessToken: vi.fn(),
  fetch: vi.fn(),
  casWinner: null as TokenRow | null,
  updateFailuresRemaining: 0,
}));

const drizzleMocks = vi.hoisted(() => ({
  eq: vi.fn((column: unknown, value: unknown) => ({
    kind: "eq",
    column,
    value,
  })),
  and: vi.fn(
    (...conditions: Array<{ kind: string; column: unknown; value: unknown }>) => ({
      kind: "and",
      conditions,
    })
  ),
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: drizzleMocks.eq,
    and: drizzleMocks.and,
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: mocks.select.mockImplementation(() => ({
      from: () => ({
        limit: async () => [mocks.token],
      }),
    })),
    update: mocks.update.mockImplementation(() => ({
      set: (values: Partial<TokenRow>) => ({
        where: (predicate: {
          conditions?: Array<{ value: unknown }>;
        }) => ({
          returning: async () => {
            if (mocks.updateFailuresRemaining > 0) {
              mocks.updateFailuresRemaining -= 1;
              throw new Error("synthetic transient database failure");
            }
            if (mocks.casWinner) {
              mocks.token = mocks.casWinner;
              mocks.casWinner = null;
            }
            const valuesInPredicate =
              predicate.conditions?.map((condition) => condition.value) ?? [];
            if (
              !valuesInPredicate.includes(mocks.token.id) ||
              !valuesInPredicate.includes(mocks.token.refreshToken)
            ) {
              return [];
            }
            mocks.token = { ...mocks.token, ...values };
            return [{ accessToken: mocks.token.accessToken }];
          },
        }),
      }),
    })),
  },
}));

vi.mock("./oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./oauth")>();
  return {
    ...actual,
    refreshAccessToken: mocks.refreshAccessToken,
  };
});

function jsonResponse(
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authorization(init?: RequestInit): string | null {
  return new Headers(init?.headers).get("Authorization");
}

beforeEach(() => {
  vi.resetModules();
  mocks.token = {
    id: 1,
    accessToken: "old-access",
    refreshToken: "old-refresh",
    expiresAt: Number.MAX_SAFE_INTEGER,
    scope: "daily",
    updatedAt: 1,
  };
  mocks.casWinner = null;
  mocks.updateFailuresRemaining = 0;
  mocks.select.mockClear();
  mocks.update.mockClear();
  drizzleMocks.eq.mockClear();
  drizzleMocks.and.mockClear();
  mocks.refreshAccessToken.mockReset().mockResolvedValue({
    access_token: "new-access",
    refresh_token: "new-refresh",
    expires_in: 3600,
    token_type: "bearer",
  });
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Oura authenticated client", () => {
  it("coalesces concurrent refreshes for an expired token", async () => {
    mocks.token.expiresAt = 0;
    let finishRefresh:
      | ((value: {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          token_type: string;
        }) => void)
      | undefined;
    mocks.refreshAccessToken.mockReturnValue(
      new Promise((resolve) => {
        finishRefresh = resolve;
      })
    );
    mocks.fetch.mockImplementation(async () =>
      jsonResponse({ id: "synthetic" })
    );
    const { ouraFetchSingle } = await import("./client");

    const requests = [
      ouraFetchSingle("v2/usercollection/personal_info"),
      ouraFetchSingle("v2/usercollection/personal_info"),
      ouraFetchSingle("v2/usercollection/personal_info"),
    ];

    await vi.waitFor(() =>
      expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1)
    );
    finishRefresh?.({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 3600,
      token_type: "bearer",
    });
    await Promise.all(requests);

    const { oauthTokens } = await import("@/lib/db/schema");
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(drizzleMocks.and).toHaveBeenCalledTimes(1);
    expect(drizzleMocks.eq).toHaveBeenNthCalledWith(1, oauthTokens.id, 1);
    expect(drizzleMocks.eq).toHaveBeenNthCalledWith(
      2,
      oauthTokens.refreshToken,
      "old-refresh"
    );
    expect(mocks.token.scope).toBe("daily");
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    for (const [, init] of mocks.fetch.mock.calls) {
      expect(authorization(init)).toBe("Bearer new-access");
    }
  });

  it("refreshes and retries once after an endpoint 401", async () => {
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ id: "synthetic" }));
    const { ouraFetchSingle } = await import("./client");

    await expect(
      ouraFetchSingle("v2/usercollection/personal_info")
    ).resolves.toEqual({ id: "synthetic" });

    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(authorization(mocks.fetch.mock.calls[0][1])).toBe(
      "Bearer old-access"
    );
    expect(authorization(mocks.fetch.mock.calls[1][1])).toBe(
      "Bearer new-access"
    );
  });

  it("coalesces concurrent endpoint 401 refreshes", async () => {
    let finishRefresh:
      | ((value: {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          token_type: string;
        }) => void)
      | undefined;
    mocks.refreshAccessToken.mockReturnValue(
      new Promise((resolve) => {
        finishRefresh = resolve;
      })
    );
    mocks.fetch.mockImplementation(async (_url, init) => {
      if (authorization(init) === "Bearer old-access") {
        return jsonResponse({ error: "unauthorized" }, 401);
      }
      return jsonResponse({ id: "synthetic" });
    });
    const { ouraFetchSingle } = await import("./client");

    const requests = [
      ouraFetchSingle("v2/usercollection/daily_resilience"),
      ouraFetchSingle("v2/usercollection/daily_resilience"),
      ouraFetchSingle("v2/usercollection/daily_resilience"),
    ];

    await vi.waitFor(() =>
      expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1)
    );
    finishRefresh?.({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 3600,
      token_type: "bearer",
    });
    await Promise.all(requests);

    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(6);
    const authorizations = mocks.fetch.mock.calls.map(([, init]) =>
      authorization(init)
    );
    expect(
      authorizations.filter((value) => value === "Bearer old-access")
    ).toHaveLength(3);
    expect(
      authorizations.filter((value) => value === "Bearer new-access")
    ).toHaveLength(3);
  });

  it("stops after a second endpoint 401", async () => {
    mocks.fetch.mockResolvedValue(
      jsonResponse({ error: "unauthorized" }, 401)
    );
    const { ouraFetchSingle } = await import("./client");

    await expect(
      ouraFetchSingle("v2/usercollection/daily_resilience")
    ).rejects.toMatchObject({
      name: "OuraRequestError",
      status: 401,
      operation: "v2/usercollection/daily_resilience",
    });
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });

  it("does not refresh or retry a 403", async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ error: "forbidden" }, 403));
    const { ouraFetchSingle } = await import("./client");

    await expect(
      ouraFetchSingle("v2/usercollection/personal_info")
    ).rejects.toMatchObject({
      name: "OuraRequestError",
      status: 403,
      operation: "v2/usercollection/personal_info",
    });
    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("recovers when another instance already rotated the token", async () => {
    mocks.token.expiresAt = 0;
    mocks.refreshAccessToken.mockImplementation(async () => {
      setTimeout(() => {
        mocks.token = {
          ...mocks.token,
          accessToken: "winner-access",
          refreshToken: "winner-refresh",
          expiresAt: Number.MAX_SAFE_INTEGER,
        };
      }, 25);
      throw new OuraRequestError(401, "token_refresh");
    });
    mocks.fetch.mockResolvedValue(jsonResponse({ id: "synthetic" }));
    const { ouraFetchSingle } = await import("./client");

    await expect(
      ouraFetchSingle("v2/usercollection/personal_info")
    ).resolves.toEqual({ id: "synthetic" });
    expect(authorization(mocks.fetch.mock.calls[0][1])).toBe(
      "Bearer winner-access"
    );
  });

  it("clears a rejected refresh flight before a later retry", async () => {
    mocks.token.expiresAt = 0;
    mocks.refreshAccessToken.mockRejectedValueOnce(
      new OuraRequestError(401, "token_refresh")
    );
    mocks.fetch.mockResolvedValue(jsonResponse({ id: "synthetic" }));
    const { ouraFetchSingle } = await import("./client");

    await expect(
      ouraFetchSingle("v2/usercollection/personal_info")
    ).rejects.toMatchObject({
      name: "OuraRequestError",
      status: 401,
      operation: "token_refresh",
    });
    await expect(
      ouraFetchSingle("v2/usercollection/personal_info")
    ).resolves.toEqual({ id: "synthetic" });

    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(2);
    expect(authorization(mocks.fetch.mock.calls[0][1])).toBe(
      "Bearer new-access"
    );
  });

  it("retries persistence after a successful token rotation", async () => {
    mocks.token.expiresAt = 0;
    mocks.updateFailuresRemaining = 1;
    mocks.fetch.mockResolvedValue(jsonResponse({ id: "synthetic" }));
    const { ouraFetchSingle } = await import("./client");

    await expect(
      ouraFetchSingle("v2/usercollection/personal_info")
    ).resolves.toEqual({ id: "synthetic" });

    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.token.accessToken).toBe("new-access");
    expect(mocks.token.refreshToken).toBe("new-refresh");
  });

  it("retries only the failed page during pagination", async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "page-one" }],
          next_token: "page-two",
        })
      )
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [{ id: "page-two" }],
          next_token: null,
        })
      );
    const { ouraFetch } = await import("./client");

    await expect(
      ouraFetch<{ id: string }>("v2/usercollection/daily_resilience")
    ).resolves.toEqual([{ id: "page-one" }, { id: "page-two" }]);

    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(mocks.refreshAccessToken).toHaveBeenCalledTimes(1);
    const secondUrl = String(mocks.fetch.mock.calls[1][0]);
    const thirdUrl = String(mocks.fetch.mock.calls[2][0]);
    expect(secondUrl).toContain("next_token=page-two");
    expect(thirdUrl).toBe(secondUrl);
    expect(
      mocks.fetch.mock.calls.map(([, init]) => authorization(init))
    ).toEqual([
      "Bearer old-access",
      "Bearer old-access",
      "Bearer new-access",
    ]);
  });

  it("uses the database winner when compare-and-swap loses", async () => {
    mocks.token.expiresAt = 0;
    mocks.casWinner = {
      ...mocks.token,
      accessToken: "winner-access",
      refreshToken: "winner-refresh",
      expiresAt: Number.MAX_SAFE_INTEGER,
    };
    mocks.fetch.mockResolvedValue(jsonResponse({ id: "synthetic" }));
    const { ouraFetchSingle } = await import("./client");

    await expect(
      ouraFetchSingle("v2/usercollection/personal_info")
    ).resolves.toEqual({ id: "synthetic" });
    expect(authorization(mocks.fetch.mock.calls[0][1])).toBe(
      "Bearer winner-access"
    );
  });

  it("keeps refresh flights separate across token generations", async () => {
    mocks.token.expiresAt = 0;
    let finishOldRefresh:
      | ((value: {
          access_token: string;
          refresh_token: string;
          expires_in: number;
          token_type: string;
        }) => void)
      | undefined;
    mocks.refreshAccessToken.mockImplementation((refreshToken: string) => {
      if (refreshToken === "old-refresh") {
        return new Promise((resolve) => {
          finishOldRefresh = resolve;
        });
      }
      return Promise.resolve({
        access_token: "latest-access",
        refresh_token: "latest-refresh",
        expires_in: 3600,
        token_type: "bearer",
      });
    });
    mocks.fetch.mockImplementation(async (_url, init) => {
      if (authorization(init) === "Bearer middle-access") {
        return jsonResponse({ error: "unauthorized" }, 401);
      }
      return jsonResponse({ id: "synthetic" });
    });
    const { ouraFetchSingle } = await import("./client");

    const oldGenerationRequest = ouraFetchSingle(
      "v2/usercollection/personal_info"
    );
    await vi.waitFor(() =>
      expect(mocks.refreshAccessToken).toHaveBeenCalledWith("old-refresh")
    );
    mocks.token = {
      ...mocks.token,
      accessToken: "middle-access",
      refreshToken: "middle-refresh",
      expiresAt: Number.MAX_SAFE_INTEGER,
    };

    const middleGenerationRequest = ouraFetchSingle(
      "v2/usercollection/personal_info"
    );
    await expect(middleGenerationRequest).resolves.toEqual({
      id: "synthetic",
    });
    expect(mocks.refreshAccessToken).toHaveBeenCalledWith("middle-refresh");

    finishOldRefresh?.({
      access_token: "stale-access",
      refresh_token: "stale-refresh",
      expires_in: 3600,
      token_type: "bearer",
    });
    await expect(oldGenerationRequest).resolves.toEqual({ id: "synthetic" });
    expect(mocks.token.accessToken).toBe("latest-access");
    expect(mocks.token.refreshToken).toBe("latest-refresh");
  });
});
