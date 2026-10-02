import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FallbackSetting } from "@/lib/thoughts-fallback-setting";
import { GET } from "./route";

const state = vi.hoisted(() => ({
  setting: { enabled: true, updatedAt: null, updatedBy: null } as FallbackSetting,
  lastActivity: null as number | null,
  inserted: [] as unknown[],
}));

vi.mock("@/lib/thoughts-fallback-setting", () => ({
  loadFallbackSetting: async () => state.setting,
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => Promise.resolve([{ at: state.lastActivity }]),
    }),
    insert: () => ({
      values: (row: unknown) => ({
        onConflictDoNothing: async () => {
          state.inserted.push(row);
          return { rowsAffected: 1 };
        },
      }),
    }),
  },
}));

// 11:00 AM ET on Wed Sep 30 2026, two days after the last entry.
const NOW = Date.parse("2026-09-30T15:00:00Z");
const TWO_DAYS_AGO = NOW / 1000 - 2 * 24 * 3600;

const originalEnv = { ...process.env };

function tick() {
  return GET(
    new NextRequest("http://localhost/api/cron/thoughts-fallback", {
      headers: { authorization: "Bearer cron-secret" },
    })
  );
}

describe("thoughts-fallback cron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env.CRON_SECRET = "cron-secret";
    process.env.AUTH_SECRET = "seed";
    delete process.env.THOUGHTS_FALLBACK_ENABLED;
    state.setting = { enabled: true, updatedAt: null, updatedBy: null };
    state.lastActivity = TWO_DAYS_AGO;
    state.inserted = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...originalEnv };
  });

  it("logs a thought after a long quiet stretch while switched on", async () => {
    const body = await (await tick()).json();
    expect(body.status).toBe("ok");
    expect(state.inserted).toHaveLength(1);
  });

  it("logs nothing while an admin has it switched off", async () => {
    state.setting = { enabled: false, updatedAt: TWO_DAYS_AGO, updatedBy: "a@example.com" };
    const body = await (await tick()).json();
    expect(body.status).toBe("disabled");
    expect(state.inserted).toHaveLength(0);
  });

  it("waits a fresh stretch after being switched back on, instead of firing at once", async () => {
    state.setting = { enabled: true, updatedAt: NOW / 1000 - 60, updatedBy: "a@example.com" };
    const body = await (await tick()).json();
    expect(body.status).toBe("not-due");
    expect(state.inserted).toHaveLength(0);
  });

  it("lets the environment override switch it off regardless", async () => {
    process.env.THOUGHTS_FALLBACK_ENABLED = "0";
    const body = await (await tick()).json();
    expect(body.status).toBe("disabled");
    expect(state.inserted).toHaveLength(0);
  });
});
