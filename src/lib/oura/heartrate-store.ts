import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyHeartrate, hourlyHeartrate } from "@/lib/db/schema";
import type {
  DailyHeartRateBucket,
  HourlyHeartRateBucket,
} from "./heartrate";

/**
 * Rows per statement. A 90-day backfill has about 2,200 hourly buckets;
 * writing them one statement at a time spent most of the backfill's time
 * budget on round trips. 200 rows stays far below SQLite's parameter limit.
 */
export const HEART_RATE_WRITE_BATCH = 200;

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError("Chunk size must be a positive integer");
  }
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

/** Upserts daily and hourly heart-rate buckets in batches. */
export async function upsertHeartRateBuckets(
  buckets: { daily: DailyHeartRateBucket[]; hourly: HourlyHeartRateBucket[] },
  now: number
): Promise<void> {
  for (const rows of chunk(buckets.daily, HEART_RATE_WRITE_BATCH)) {
    await db
      .insert(dailyHeartrate)
      .values(rows.map((bucket) => ({ ...bucket, createdAt: now })))
      .onConflictDoUpdate({
        target: dailyHeartrate.day,
        set: {
          avgBpm: sql`excluded.avg_bpm`,
          minBpm: sql`excluded.min_bpm`,
          maxBpm: sql`excluded.max_bpm`,
          restingBpm: sql`excluded.resting_bpm`,
          awakeBpm: sql`excluded.awake_bpm`,
          sampleCount: sql`excluded.sample_count`,
        },
      });
  }

  for (const rows of chunk(buckets.hourly, HEART_RATE_WRITE_BATCH)) {
    await db
      .insert(hourlyHeartrate)
      .values(rows.map((bucket) => ({ ...bucket, createdAt: now })))
      .onConflictDoUpdate({
        target: [hourlyHeartrate.day, hourlyHeartrate.hour],
        set: {
          avgBpm: sql`excluded.avg_bpm`,
          minBpm: sql`excluded.min_bpm`,
          maxBpm: sql`excluded.max_bpm`,
          sampleCount: sql`excluded.sample_count`,
          source: sql`excluded.source`,
        },
      });
  }
}
