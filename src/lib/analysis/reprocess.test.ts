import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  dailyAnalysis,
  episodeAssessments,
  sleepPeriods,
} from "@/lib/db/schema";
import { DEFAULT_CONFIG } from "./config";
import { PATTERN_ALGORITHM_VERSION } from "./provenance";
import { reprocessAll } from "./reprocess";

vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/db/schema");
  return { db: drizzle(createClient({ url: ":memory:" }), { schema }) };
});

function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function nights(firstDay: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const day = shiftDay(firstDay, index);
    const wobble = (index % 5) - 2;
    return {
      id: `night-${day}`,
      day,
      type: "long_sleep",
      bedtimeStart: `${shiftDay(day, -1)}T23:${String(10 + wobble * 4).padStart(2, "0")}:00-04:00`,
      bedtimeEnd: `${day}T06:${String(50 + wobble * 3).padStart(2, "0")}:00-04:00`,
      totalSleepDuration: (420 + wobble * 12) * 60,
      deepSleepDuration: 80 * 60,
      lightSleepDuration: (240 + wobble * 12) * 60,
      remSleepDuration: 100 * 60,
      efficiency: 88 + wobble,
      latency: (12 + wobble) * 60,
      averageHrv: 40 + wobble,
      averageHeartRate: 58 - wobble,
      createdAt: 0,
    };
  });
}

function olderResult(day: string) {
  return {
    analysis: { day, compositeScore: 0.4, isAnomaly: 0, createdAt: 0 },
    assessment: {
      day,
      tier: "watch",
      direction: "hypo",
      confidence: 0.5,
      configVersion: 1,
      createdAt: 0,
    },
  };
}

async function storedDays() {
  const [analysis, assessments] = await Promise.all([
    db.select({ day: dailyAnalysis.day }).from(dailyAnalysis),
    db
      .select({
        day: episodeAssessments.day,
        algorithmVersion: episodeAssessments.algorithmVersion,
      })
      .from(episodeAssessments),
  ]);
  return {
    analysis: analysis.map((row) => row.day).sort(),
    assessments: new Map(
      assessments.map((row) => [row.day, row.algorithmVersion])
    ),
  };
}

// Forty nights, eight weeks without the ring, then fifteen nights back. The
// first fourteen nights back have no baseline yet; the fifteenth does.
const BEFORE = nights("2025-03-01", 40);
const AFTER = nights("2025-06-10", 15);
const SCORED_AFTER_GAP = "2025-06-24";

describe("reprocessAll", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  beforeEach(async () => {
    await db.delete(dailyAnalysis);
    await db.delete(episodeAssessments);
    await db.delete(sleepPeriods);
    await db.insert(sleepPeriods).values([...BEFORE, ...AFTER]);
    for (const day of ["2025-04-01", "2025-06-12", "2025-06-20"]) {
      const older = olderResult(day);
      await db.insert(dailyAnalysis).values(older.analysis);
      await db.insert(episodeAssessments).values(older.assessment);
    }
  });

  it("drops older results for days the current algorithm no longer scores", async () => {
    const result = await reprocessAll(DEFAULT_CONFIG, undefined, "2025-06-30");
    const stored = await storedDays();

    expect(stored.analysis).not.toContain("2025-06-12");
    expect(stored.analysis).not.toContain("2025-06-20");
    expect(stored.assessments.has("2025-06-12")).toBe(false);
    expect(stored.assessments.has("2025-06-20")).toBe(false);
    expect(stored.assessments.get("2025-04-01")).toBe(PATTERN_ALGORITHM_VERSION);
    expect(stored.assessments.get(SCORED_AFTER_GAP)).toBe(
      PATTERN_ALGORITHM_VERSION
    );
    expect(
      [...stored.assessments.values()].every(
        (version) => version === PATTERN_ALGORITHM_VERSION
      )
    ).toBe(true);
    expect(result.resultsRemoved).toBe(2);
  });

  it("leaves results outside the recomputed window alone", async () => {
    const result = await reprocessAll(DEFAULT_CONFIG, "2025-06-15", "2025-06-30");
    const stored = await storedDays();

    expect(stored.assessments.has("2025-06-20")).toBe(false);
    expect(stored.assessments.get("2025-06-12")).toBeNull();
    expect(stored.assessments.get("2025-04-01")).toBeNull();
    expect(stored.analysis).toContain("2025-06-12");
    expect(result.resultsRemoved).toBe(1);
  });

  it("keeps results for a night synced after it read the nights", async () => {
    // As if the hourly sync scored a new night while a backfill was running.
    const later = olderResult("2025-06-26");
    await db.insert(dailyAnalysis).values(later.analysis);
    await db.insert(episodeAssessments).values(later.assessment);

    await reprocessAll(DEFAULT_CONFIG, undefined, "2025-06-30");
    const stored = await storedDays();

    expect(stored.analysis).toContain("2025-06-26");
    expect(stored.assessments.has("2025-06-26")).toBe(true);
  });
});
