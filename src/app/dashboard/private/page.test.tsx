import { migrate } from "drizzle-orm/libsql/migrator";
import {
  Children,
  isValidElement,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
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
import { sleepPeriods } from "@/lib/db/schema";
import PrivatePage from "./page";
import { PrivateTabs } from "./private-tabs";

vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/db/schema");
  return { db: drizzle(createClient({ url: ":memory:" }), { schema }) };
});

vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { email: "owner@example.com" } }),
  isSensitiveUser: () => true,
}));

type PeriodInsert = typeof sleepPeriods.$inferInsert;

function period(
  id: string,
  type: "long_sleep" | "sleep",
  day: string,
  bedtimeStart: string,
  bedtimeEnd: string,
  asleepMinutes: number
): PeriodInsert {
  return {
    id,
    day,
    type,
    bedtimeStart,
    bedtimeEnd,
    totalSleepDuration: asleepMinutes * 60,
    createdAt: 0,
  };
}

async function privateTabsProps() {
  const page = (await PrivatePage()) as ReactElement<{ children: ReactNode }>;
  const tabs = Children.toArray(page.props.children).find(
    (child): child is ReactElement<ComponentProps<typeof PrivateTabs>> =>
      isValidElement(child) && child.type === PrivateTabs
  );
  return tabs!.props;
}

describe("Private page", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-07T16:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    await db.delete(sleepPeriods);
    await db.insert(sleepPeriods).values([
      period(
        "night-oct-4",
        "long_sleep",
        "2026-10-04",
        "2026-10-03T23:00:00-04:00",
        "2026-10-04T06:00:00-04:00",
        400
      ),
      period(
        "afternoon-oct-4",
        "long_sleep",
        "2026-10-04",
        "2026-10-04T14:00:00-04:00",
        "2026-10-04T17:40:00-04:00",
        200
      ),
      period(
        "night-oct-5",
        "long_sleep",
        "2026-10-05",
        "2026-10-04T23:10:00-04:00",
        "2026-10-05T06:50:00-04:00",
        420
      ),
      period(
        "short-oct-6",
        "sleep",
        "2026-10-06",
        "2026-10-06T03:30:00-04:00",
        "2026-10-06T05:50:00-04:00",
        130
      ),
    ]);
  });

  it("lists the short night in Sleep Timing, one row for each night", async () => {
    const { bedtimeData } = await privateTabsProps();

    expect(
      bedtimeData.map((night) => [night.day, night.actualBedtime])
    ).toEqual([
      ["2026-10-04", 23 * 60],
      ["2026-10-05", 23 * 60 + 10],
      ["2026-10-06", 24 * 60 + 3 * 60 + 30],
    ]);
  });

  it("dates the sleep freshness by the latest night, whatever its type", async () => {
    const { sourceFreshness } = await privateTabsProps();

    expect(sourceFreshness.sleep.lastSourceDay).toBe("2026-10-06");
  });
});
