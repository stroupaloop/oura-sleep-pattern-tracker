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
import { dailyAnalysis, oauthTokens, sleepPeriods } from "@/lib/db/schema";
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

describe("loadHealthDashboard last week and short-night run", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    const existing = await db.select().from(oauthTokens).limit(1);
    if (existing.length === 0) {
      await db.insert(oauthTokens).values({
        accessToken: "access",
        refreshToken: "refresh",
        expiresAt: 0,
        scope: "email personal daily heartrate workout tag session spo2 stress heart_health",
        updatedAt: 0,
      });
    }
  });

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T16:00:00Z"));
    await db.delete(sleepPeriods);
    await db.delete(dailyAnalysis);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** A night of `hours` hours, with the analysis the detector would store for it. */
  async function record(day: string, hours: number, sleepZ: number | null) {
    await db
      .insert(sleepPeriods)
      .values({ ...night(day), totalSleepDuration: hours * 3600 });
    await db.insert(dailyAnalysis).values({
      day,
      totalSleepMinutes: hours * 60,
      baselineSleepMinutes: 420,
      sleepDurationZScore: sleepZ,
      baselineBedtimeMinutes: -60,
      baselineWakeMinutes: 420,
      createdAt: 0,
    });
  }

  it("draws the last seven nights, newest first, with a missing one left as a gap", async () => {
    for (const day of ["2026-10-06", "2026-10-05", "2026-10-04", "2026-10-02", "2026-10-01", "2026-09-30"]) {
      await record(day, 7, 0);
    }

    const { week } = (await loadHealthDashboard())!;

    expect(week!.rows.map((row) => row.day)).toEqual([
      "2026-10-06",
      "2026-10-05",
      "2026-10-04",
      "2026-10-03",
      "2026-10-02",
      "2026-10-01",
      "2026-09-30",
    ]);
    expect(week!.rows.filter((row) => !row.recorded).map((row) => row.day)).toEqual([
      "2026-10-03",
    ]);
    expect(week!.rows[0]).toMatchObject({
      asleep: "7h 0m",
      comparison: "About usual",
      bedtimeLabel: "11:00 PM",
      wakeLabel: "7:00 AM",
    });
    expect(week!.rows[0].usual).not.toBeNull();
  });

  it("ends the week on the last night that is due: until noon, the morning's night is not a gap", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
    await record("2026-10-05", 7, 0);

    const { week } = (await loadHealthDashboard())!;

    expect(week!.rows[0].day).toBe("2026-10-05");
    expect(week!.rows.filter((row) => row.day > "2026-10-05")).toEqual([]);
  });

  it("says there is no baseline yet for nights that have not been analysed", async () => {
    await db.insert(sleepPeriods).values(night(TODAY));

    const { week, shortRun } = (await loadHealthDashboard())!;

    expect(week!.rows[0]).toMatchObject({ comparison: "No baseline yet", level: "unknown" });
    expect(shortRun).toBeNull();
  });

  it("counts short nights in a row back from the latest, and how much less sleep they added up to", async () => {
    await record("2026-10-03", 7, 0.2);
    await record("2026-10-04", 6, -1.4);
    await record("2026-10-05", 5.5, -2);
    await record("2026-10-06", 6.5, -1.1);

    const { shortRun } = (await loadHealthDashboard())!;

    expect(shortRun).toEqual({ nights: 3, minutesShort: 60 + 90 + 30, endedByGap: false });
  });

  it("says the run may be longer when it ends at a night with nothing recorded", async () => {
    await record("2026-10-05", 5.5, -2);
    await record("2026-10-06", 6, -1.4);

    const { shortRun } = (await loadHealthDashboard())!;

    expect(shortRun).toEqual({ nights: 2, minutesShort: 90 + 60, endedByGap: true });
  });

  it("has no run when the latest night is within her usual", async () => {
    await record("2026-10-05", 5.5, -2);
    await record("2026-10-06", 7, -0.2);

    expect((await loadHealthDashboard())!.shortRun).toBeNull();
  });

  it("counts back from the latest night on record when this morning's has not arrived", async () => {
    vi.setSystemTime(new Date("2026-10-06T10:00:00Z"));
    await record("2026-10-04", 6, -1.4);
    await record("2026-10-05", 5.5, -2);

    expect((await loadHealthDashboard())!.shortRun).toMatchObject({ nights: 2 });
  });
});
