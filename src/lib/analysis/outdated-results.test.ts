import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { episodeAssessments } from "@/lib/db/schema";
import { hasOutdatedPatternResults } from "./outdated-results";
import { PATTERN_ALGORITHM_VERSION, PATTERN_SIGNAL_MODE } from "./provenance";

vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/db/schema");
  return { db: drizzle(createClient({ url: ":memory:" }), { schema }) };
});

function stored(day: string, overrides: Record<string, unknown> = {}) {
  return {
    day,
    tier: "none",
    confidence: 0,
    configVersion: 1,
    bipolarProfile: "bp2",
    algorithmVersion: PATTERN_ALGORITHM_VERSION,
    signalMode: PATTERN_SIGNAL_MODE,
    createdAt: 0,
    ...overrides,
  };
}

describe("hasOutdatedPatternResults", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  beforeEach(async () => {
    await db.delete(episodeAssessments);
  });

  it("finds nothing out of date when nothing is stored", async () => {
    expect(await hasOutdatedPatternResults(1, "bp2")).toBe(false);
  });

  it("finds nothing out of date when every result is current", async () => {
    await db
      .insert(episodeAssessments)
      .values([stored("2026-10-01"), stored("2026-10-02"), stored("2026-10-03")]);

    expect(await hasOutdatedPatternResults(1, "bp2")).toBe(false);
  });

  it("finds one result from an older algorithm among current ones", async () => {
    await db.insert(episodeAssessments).values([
      stored("2026-10-01", { algorithmVersion: "2026.10.3" }),
      stored("2026-10-02"),
      stored("2026-10-03"),
    ]);

    expect(await hasOutdatedPatternResults(1, "bp2")).toBe(true);
  });

  it("finds results made for another profile or configuration", async () => {
    await db.insert(episodeAssessments).values([stored("2026-10-01")]);

    expect(await hasOutdatedPatternResults(1, "bp1")).toBe(true);
    expect(await hasOutdatedPatternResults(2, "bp2")).toBe(true);
  });

  it("finds a result stored without any record of where it came from", async () => {
    await db.insert(episodeAssessments).values([
      stored("2026-10-01"),
      stored("2026-10-02", {
        configVersion: null,
        bipolarProfile: null,
        algorithmVersion: null,
        signalMode: null,
      }),
    ]);

    expect(await hasOutdatedPatternResults(1, "bp2")).toBe(true);
  });
});
