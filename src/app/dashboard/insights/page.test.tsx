import { isValidElement, type ReactElement, type ReactNode } from "react";
import { migrate } from "drizzle-orm/libsql/migrator";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@/lib/db";
import { dailyAnalysis, sleepPeriods } from "@/lib/db/schema";
import { shiftIsoDay } from "@/lib/date-utils";
import InsightsPage from "./page";
import { InsightsTabs } from "./insights-tabs";

vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/db/schema");
  return { db: drizzle(createClient({ url: ":memory:" }), { schema }) };
});

const TODAY = "2026-10-06";

function night(day: string, type = "long_sleep", bed = "23:00", seconds = 25_200) {
  return {
    id: `${type}-${day}`,
    day,
    type,
    bedtimeStart: `${shiftIsoDay(day, -1)}T${bed}:00-04:00`,
    bedtimeEnd: `${day}T07:00:00-04:00`,
    totalSleepDuration: seconds,
    createdAt: 0,
  };
}

function findTabs(node: ReactNode): ReactElement | null {
  if (!isValidElement(node)) return null;
  if (node.type === InsightsTabs) return node;
  const children = (node.props as { children?: ReactNode }).children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findTabs(child);
    if (found) return found;
  }
  return null;
}

async function renderedTabs(params: Record<string, string> = {}) {
  const tabs = findTabs(
    await InsightsPage({ searchParams: Promise.resolve(params) })
  );
  expect(tabs).not.toBeNull();
  return tabs!.props as {
    analysis: Array<{ day: string }>;
    range: { start: string; end: string };
    nightDays: string[];
  };
}

describe("InsightsPage", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T16:00:00Z"));
    await db.delete(dailyAnalysis);
    await db.delete(sleepPeriods);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives the tabs the 90 days to today and the days that have a night", async () => {
    await db.insert(sleepPeriods).values([
      night("2026-10-01"),
      night("2026-10-02"),
      night("2026-10-05"),
      night("2026-10-05", "sleep", "13:00", 1_800),
      night("2026-06-01"),
    ]);
    await db.insert(dailyAnalysis).values({
      day: "2026-10-01",
      isAnomaly: 0,
      createdAt: 0,
    });

    const tabs = await renderedTabs();

    expect(tabs.range).toEqual({ start: "2026-07-09", end: TODAY });
    expect(tabs.analysis.map((row) => row.day)).toEqual(["2026-10-01"]);
    expect([...tabs.nightDays].sort()).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-05",
    ]);
  });

  describe("date range", () => {
    beforeEach(async () => {
      await db.insert(dailyAnalysis).values(
        ["2026-03-10", "2026-08-15", "2026-09-20", "2026-10-02"].map((day) => ({
          day,
          isAnomaly: 0,
          createdAt: 0,
        }))
      );
    });

    it("follows a preset", async () => {
      const tabs = await renderedTabs({ range: "30d" });
      expect(tabs.range).toEqual({ start: "2026-09-07", end: TODAY });
      expect(tabs.analysis.map((row) => row.day)).toEqual(["2026-09-20", "2026-10-02"]);
    });

    it("follows dates, both ends included", async () => {
      const tabs = await renderedTabs({ from: "2026-08-15", to: "2026-09-20" });
      expect(tabs.range).toEqual({ start: "2026-08-15", end: "2026-09-20" });
      expect(tabs.analysis.map((row) => row.day)).toEqual(["2026-08-15", "2026-09-20"]);
    });

    it("starts all-time at the first day on record", async () => {
      const tabs = await renderedTabs({ range: "all" });
      expect(tabs.range).toEqual({ start: "2026-03-10", end: TODAY });
      expect(tabs.analysis).toHaveLength(4);
    });
  });

  it("counts a day with only a short daytime sleep as having no night", async () => {
    await db
      .insert(sleepPeriods)
      .values([night("2026-10-03", "sleep", "13:00", 1_800)]);
    await db.insert(dailyAnalysis).values({
      day: "2026-10-01",
      isAnomaly: 0,
      createdAt: 0,
    });

    const tabs = await renderedTabs();

    expect(tabs.nightDays).toEqual([]);
  });
});
