import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  statements: [] as Array<{ table: unknown; rows: unknown[] }>,
}));

vi.mock("@/lib/db", () => ({
  db: {
    insert: (table: unknown) => ({
      values: (rows: unknown[]) => {
        mocks.statements.push({ table, rows });
        return { onConflictDoUpdate: async () => undefined };
      },
    }),
  },
}));

beforeEach(() => {
  mocks.statements.length = 0;
});

describe("chunk", () => {
  it("splits into consecutive pieces of at most the size", async () => {
    const { chunk } = await import("./heartrate-store");
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
    expect(() => chunk([1], 0)).toThrow(RangeError);
  });
});

describe("upsertHeartRateBuckets", () => {
  it("writes 90 days of buckets in a handful of statements", async () => {
    const { dailyHeartrate, hourlyHeartrate } = await import("@/lib/db/schema");
    const { upsertHeartRateBuckets, HEART_RATE_WRITE_BATCH } = await import(
      "./heartrate-store"
    );
    const daily = Array.from({ length: 90 }, (_, index) => ({
      day: `2026-07-${String((index % 28) + 1).padStart(2, "0")}`,
      avgBpm: 70,
      minBpm: 50,
      maxBpm: 120,
      restingBpm: 58,
      awakeBpm: 75,
      sampleCount: 300,
    }));
    const hourly = Array.from({ length: 90 * 24 }, (_, index) => ({
      day: "2026-07-01",
      hour: index % 24,
      avgBpm: 70,
      minBpm: 60,
      maxBpm: 80,
      sampleCount: 12,
      source: "rest",
    }));

    await upsertHeartRateBuckets({ daily, hourly }, 1790950000);

    const dailyStatements = mocks.statements.filter(
      (statement) => statement.table === dailyHeartrate
    );
    const hourlyStatements = mocks.statements.filter(
      (statement) => statement.table === hourlyHeartrate
    );
    expect(dailyStatements).toHaveLength(1);
    expect(hourlyStatements).toHaveLength(
      Math.ceil((90 * 24) / HEART_RATE_WRITE_BATCH)
    );
    expect(
      hourlyStatements.reduce((total, statement) => total + statement.rows.length, 0)
    ).toBe(90 * 24);
    expect(dailyStatements[0].rows[0]).toMatchObject({
      restingBpm: 58,
      createdAt: 1790950000,
    });
  });
});
