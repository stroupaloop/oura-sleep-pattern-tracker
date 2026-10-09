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
import { oauthTokens, sleepPeriods } from "@/lib/db/schema";
import { shiftIsoDay } from "@/lib/date-utils";
import { loadHealthDashboard } from "./health-dashboard-data";

vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/db/schema");
  return { db: drizzle(createClient({ url: ":memory:" }), { schema }) };
});

const TODAY = "2026-10-06";

function night(day: string) {
  return {
    id: `night-${day}`,
    day,
    type: "long_sleep",
    bedtimeStart: `${shiftIsoDay(day, -1)}T23:00:00-04:00`,
    bedtimeEnd: `${day}T07:00:00-04:00`,
    totalSleepDuration: 25_200,
    deepSleepDuration: 5_040,
    remSleepDuration: 6_120,
    lightSleepDuration: 14_040,
    awakeTime: 1_800,
    timeInBed: 27_000,
    efficiency: 90,
    latency: 600,
    averageHrv: 42,
    averageHeartRate: 58,
    createdAt: 0,
  };
}

function nightsBetween(first: string, last: string, missing: string[] = []) {
  const days: string[] = [];
  for (let day = first; day <= last; day = shiftIsoDay(day, 1)!) {
    if (!missing.includes(day)) days.push(day);
  }
  return days.map(night);
}

const HOLE = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"];

describe("loadHealthDashboard trends", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    await db.insert(oauthTokens).values({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 0,
      scope: "email personal daily heartrate workout tag session spo2 stress heart_health",
      updatedAt: 0,
    });
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T16:00:00Z"));
    await db.delete(sleepPeriods);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves one empty row for each night missing from the last 30 days", async () => {
    await db
      .insert(sleepPeriods)
      .values(nightsBetween("2026-09-07", TODAY, HOLE));

    const data = await loadHealthDashboard();
    const rows = data!.trends.chartData;

    expect(rows.map((row) => row.day)).toEqual(
      Array.from({ length: 30 }, (_, index) => shiftIsoDay("2026-09-07", index))
    );
    const gaps = rows.filter((row) => row.noNight);
    expect(gaps.map((row) => row.day)).toEqual(HOLE);
    for (const gap of gaps) {
      expect(gap).toEqual({
        day: gap.day,
        hours: null,
        deep: null,
        rem: null,
        light: null,
        efficiency: null,
        hrv: null,
        hr: null,
        noNight: true,
      });
    }
    expect(rows.find((row) => row.day === "2026-09-27")).toEqual({
      day: "2026-09-27",
      hours: 7,
      deep: 1.4,
      rem: 1.7,
      light: 3.9,
      efficiency: 90,
      hrv: 42,
      hr: 58,
    });
  });

  it("counts only the nights that were recorded", async () => {
    await db
      .insert(sleepPeriods)
      .values(nightsBetween("2026-09-07", TODAY, HOLE));

    const { trends } = (await loadHealthDashboard())!;

    expect(trends.nightsCounted).toBe(26);
    expect(trends.windowDays).toBe(30);
    expect(trends.averageSleepSeconds).toBe(25_200);
  });

  it("takes the last 14 calendar days for the stage shares, not the last 14 nights", async () => {
    await db
      .insert(sleepPeriods)
      .values(nightsBetween("2026-09-07", TODAY, HOLE));

    const { trends } = (await loadHealthDashboard())!;
    const rows = trends.compositionData;

    expect(rows.map((row) => row.day)).toEqual(
      Array.from({ length: 14 }, (_, index) => shiftIsoDay("2026-09-23", index))
    );
    expect(rows.filter((row) => row.noNight).map((row) => row.day)).toEqual(HOLE);
    const gap = rows.find((row) => row.day === "2026-09-30")!;
    expect(gap.deep).toBeNull();
    expect(gap.awake).toBeNull();
    expect(gap.deepMin).toBeNull();
    expect(gap.awakeMin).toBeNull();
    const recorded = rows.find((row) => row.day === "2026-09-27")!;
    expect(recorded.noNight).toBeUndefined();
    expect(recorded.deepMin).toBe(84);
    expect(recorded.awakeMin).toBe(30);
  });

  it("keeps days before the first night off the charts", async () => {
    await db.insert(sleepPeriods).values(nightsBetween("2026-10-01", TODAY));

    const { trends } = (await loadHealthDashboard())!;

    expect(trends.chartData.map((row) => row.day)).toEqual([
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
    ]);
    expect(trends.compositionData).toHaveLength(6);
    expect(trends.chartData.some((row) => row.noNight)).toBe(false);
    expect(trends.compositionData.some((row) => row.noNight)).toBe(false);
  });

  it("shows a night that has not arrived yet as a gap at the end", async () => {
    await db
      .insert(sleepPeriods)
      .values(nightsBetween("2026-09-07", "2026-10-05"));

    const data = (await loadHealthDashboard())!;
    const last = data.trends.chartData.at(-1)!;

    expect(last).toMatchObject({ day: TODAY, hours: null, noNight: true });
    expect(data.trends.compositionData.at(-1)).toMatchObject({
      day: TODAY,
      noNight: true,
    });
    expect(data.trends.nightsCounted).toBe(29);
    expect(data.shownDay).toBe("2026-10-05");
    expect(data.isLastNight).toBe(false);
  });

  it("does not draw this morning's night as a gap before it has had time to sync", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
    await db
      .insert(sleepPeriods)
      .values(nightsBetween("2026-09-07", "2026-10-05"));

    const { trends } = (await loadHealthDashboard())!;

    expect(trends.chartData.at(-1)).toMatchObject({ day: "2026-10-05", hours: 7 });
    expect(trends.chartData.some((row) => row.noNight)).toBe(false);
    expect(trends.compositionData.at(-1)).toMatchObject({ day: "2026-10-05" });
    expect(trends.compositionData).toHaveLength(14);
    expect(trends.compositionData.some((row) => row.noNight)).toBe(false);
  });

  it("includes this morning's night as soon as it has arrived", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
    await db
      .insert(sleepPeriods)
      .values(nightsBetween("2026-09-07", TODAY));

    const { trends } = (await loadHealthDashboard())!;

    expect(trends.chartData.at(-1)).toMatchObject({ day: TODAY, hours: 7 });
    expect(trends.compositionData.at(-1)).toMatchObject({ day: TODAY });
  });

  it("still draws a missing night before this morning as a gap", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
    await db
      .insert(sleepPeriods)
      .values(nightsBetween("2026-09-07", "2026-10-05", ["2026-10-04"]));

    const { trends } = (await loadHealthDashboard())!;

    expect(trends.chartData.filter((row) => row.noNight).map((row) => row.day)).toEqual([
      "2026-10-04",
    ]);
  });

  it("draws nothing before any night is recorded", async () => {
    const { trends } = (await loadHealthDashboard())!;

    expect(trends.chartData).toEqual([]);
    expect(trends.compositionData).toEqual([]);
    expect(trends.nightsCounted).toBe(0);
  });
});
