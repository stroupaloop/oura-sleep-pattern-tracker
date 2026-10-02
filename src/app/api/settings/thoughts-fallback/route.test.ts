import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "./route";

const state = vi.hoisted(() => ({
  user: null as { email?: string | null } | null,
  saved: [] as unknown[][],
}));

vi.mock("@/lib/api-auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireApiUser: async () => state.user,
    unauthorizedResponse: () =>
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
});

vi.mock("@/lib/thoughts-fallback-setting", () => ({
  saveFallbackSetting: async (...args: unknown[]) => {
    state.saved.push(args);
  },
  loadFallbackSetting: async () => ({
    enabled: state.saved.at(-1)?.[0] ?? true,
    updatedAt: 1790000000,
    updatedBy: state.saved.at(-1)?.[1] ?? null,
  }),
}));

const originalAdminEmails = process.env.ADMIN_EMAILS;

function put(body: unknown) {
  return PUT(
    new NextRequest("http://localhost/api/settings/thoughts-fallback", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("PUT /api/settings/thoughts-fallback", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    state.user = { email: "Admin@Example.com" };
    state.saved = [];
  });

  afterEach(() => {
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalAdminEmails;
  });

  it("lets an admin switch it off and returns the saved state", async () => {
    const res = await put({ enabled: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      enabled: false,
      updatedBy: "admin@example.com",
    });
    expect(state.saved).toHaveLength(1);
  });

  it("refuses signed-in readers who are not admins", async () => {
    state.user = { email: "reader@example.com" };
    expect((await put({ enabled: false })).status).toBe(403);
    expect(state.saved).toHaveLength(0);
  });

  it("refuses anyone signed out", async () => {
    state.user = null;
    expect((await put({ enabled: false })).status).toBe(401);
    expect(state.saved).toHaveLength(0);
  });

  it("rejects anything but true or false", async () => {
    expect((await put({ enabled: "no" })).status).toBe(400);
    expect((await put({})).status).toBe(400);
    expect(state.saved).toHaveLength(0);
  });
});
