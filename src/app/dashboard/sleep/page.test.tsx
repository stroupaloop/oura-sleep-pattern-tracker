import { migrate } from "drizzle-orm/libsql/migrator";
import {
  Children,
  createElement,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  afterAll,
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
import SleepPage from "./page";
import { SleepCalendar } from "./sleep-calendar";

vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/db/schema");
  return { db: drizzle(createClient({ url: ":memory:" }), { schema }) };
});

type PeriodInsert = typeof sleepPeriods.$inferInsert;

function period(
  id: string,
  type: "long_sleep" | "sleep",
  day: string,
  bedtimeStart: string,
  bedtimeEnd: string,
  asleepMinutes: number,
  latencyMinutes = 10
): PeriodInsert {
  const inBed = (Date.parse(bedtimeEnd) - Date.parse(bedtimeStart)) / 1000;
  const asleep = asleepMinutes * 60;
  return {
    id,
    day,
    type,
    bedtimeStart,
    bedtimeEnd,
    totalSleepDuration: asleep,
    deepSleepDuration: Math.round(asleep * 0.2),
    lightSleepDuration: Math.round(asleep * 0.55),
    remSleepDuration: Math.round(asleep * 0.25),
    awakeTime: inBed - asleep,
    efficiency: Math.round((asleep / inBed) * 100),
    latency: latencyMinutes * 60,
    averageHeartRate: 58,
    lowestHeartRate: 50,
    averageHrv: 40,
    restlessPeriods: 100,
    timeInBed: inBed,
    createdAt: 0,
  };
}

async function calendarProps() {
  const page = (await SleepPage()) as ReactElement<{ children: ReactNode }>;
  const calendar = Children.toArray(page.props.children).find(
    (child): child is ReactElement<ComponentProps<typeof SleepCalendar>> =>
      isValidElement(child) && child.type === SleepCalendar
  );
  return calendar!.props;
}

describe("Sleep page", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T16:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    await db.delete(dailyAnalysis);
    await db.delete(sleepPeriods);
  });

  it("shows a night Oura typed sleep, and keeps the night when an afternoon long sleep shares its day", async () => {
    await db.insert(sleepPeriods).values([
      period(
        "short",
        "sleep",
        "2026-10-03",
        "2026-10-03T03:00:00-04:00",
        "2026-10-03T05:10:00-04:00",
        120
      ),
      period(
        "night",
        "long_sleep",
        "2026-10-04",
        "2026-10-03T23:00:00-04:00",
        "2026-10-04T06:00:00-04:00",
        400
      ),
      period(
        "afternoon",
        "long_sleep",
        "2026-10-04",
        "2026-10-04T14:00:00-04:00",
        "2026-10-04T17:40:00-04:00",
        200
      ),
    ]);

    const { nights } = await calendarProps();

    expect(Object.keys(nights).sort()).toEqual(["2026-10-03", "2026-10-04"]);
    expect(nights["2026-10-03"]).toMatchObject({
      id: "short",
      totalSleepDuration: 120 * 60,
    });
    expect(nights["2026-10-04"]).toMatchObject({
      id: "night",
      totalSleepDuration: 400 * 60,
    });
  });

  it("keeps every calendar day when days have more than one period", async () => {
    const days: string[] = [];
    for (let day = "2026-09-07"; day <= "2026-10-07"; day = shiftIsoDay(day, 1)!) {
      days.push(day);
    }
    await db.insert(sleepPeriods).values(
      days.flatMap((day) => [
        period(
          `night-${day}`,
          "long_sleep",
          day,
          `${shiftIsoDay(day, -1)}T23:00:00-04:00`,
          `${day}T06:30:00-04:00`,
          400
        ),
        period(
          `afternoon-${day}`,
          "long_sleep",
          day,
          `${day}T14:00:00-04:00`,
          `${day}T17:30:00-04:00`,
          200
        ),
      ])
    );

    const { nights } = await calendarProps();

    expect(Object.keys(nights).sort()).toEqual(days);
    expect(days.every((day) => nights[day].id === `night-${day}`)).toBe(true);
  });

  it("sets a broken night's total beside a comparison with her usual of the same night", async () => {
    await db.insert(sleepPeriods).values([
      period(
        "first",
        "long_sleep",
        "2026-10-05",
        "2026-10-04T21:30:00-04:00",
        "2026-10-05T02:30:00-04:00",
        270,
        15
      ),
      period(
        "second",
        "sleep",
        "2026-10-05",
        "2026-10-05T04:00:00-04:00",
        "2026-10-05T06:10:00-04:00",
        120,
        5
      ),
    ]);
    await db.insert(dailyAnalysis).values({
      day: "2026-10-05",
      totalSleepMinutes: 390,
      baselineSleepMinutes: 440,
      sleepDurationZScore: -1.2,
      createdAt: 0,
    });

    const html = renderToStaticMarkup(
      createElement(SleepCalendar, await calendarProps())
    );

    expect(html).toMatch(/Total Sleep<\/p><\/div><p[^>]*>6h 30m<\/p>/);
    expect(html).toContain("50m less than usual");
    expect(html).toContain("usual 7h 20m");
  });
});
