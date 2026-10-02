import { describe, expect, it } from "vitest";
import {
  combineNightPeriods,
  isOvernightPeriod,
  selectNightSleepByDay,
  type NightSleepPeriod,
} from "./main-sleep";

function period(
  overrides: Partial<NightSleepPeriod> &
    Pick<NightSleepPeriod, "bedtimeStart" | "bedtimeEnd">
): NightSleepPeriod & { id: string } {
  const seconds =
    (Date.parse(overrides.bedtimeEnd) - Date.parse(overrides.bedtimeStart)) /
    1000;
  return {
    id: `${overrides.bedtimeStart}`,
    day: "2026-08-30",
    type: "long_sleep",
    totalSleepDuration: Math.round(seconds * 0.9),
    timeInBed: seconds,
    deepSleepDuration: Math.round(seconds * 0.15),
    lightSleepDuration: Math.round(seconds * 0.5),
    remSleepDuration: Math.round(seconds * 0.25),
    awakeTime: Math.round(seconds * 0.1),
    latency: 600,
    efficiency: 90,
    ...overrides,
  };
}

describe("isOvernightPeriod", () => {
  it("counts sleep centred between 8pm and 10am ET as overnight", () => {
    expect(
      isOvernightPeriod({
        bedtimeStart: "2026-08-30T00:20:30-04:00",
        bedtimeEnd: "2026-08-30T09:00:06-04:00",
      })
    ).toBe(true);
    expect(
      isOvernightPeriod({
        bedtimeStart: "2026-08-29T14:05:32-04:00",
        bedtimeEnd: "2026-08-29T19:25:32-04:00",
      })
    ).toBe(false);
    expect(
      isOvernightPeriod({
        bedtimeStart: "2026-09-29T19:37:27-04:00",
        bedtimeEnd: "2026-09-29T19:59:32-04:00",
      })
    ).toBe(false);
  });

  it("rejects unparseable or reversed periods", () => {
    expect(
      isOvernightPeriod({ bedtimeStart: "nope", bedtimeEnd: "nope" })
    ).toBe(false);
    expect(
      isOvernightPeriod({
        bedtimeStart: "2026-08-30T06:00:00-04:00",
        bedtimeEnd: "2026-08-30T01:00:00-04:00",
      })
    ).toBe(false);
  });
});

describe("selectNightSleepByDay", () => {
  it("prefers the night over an afternoon long sleep sharing its day", () => {
    const afternoon = period({
      bedtimeStart: "2026-08-29T14:05:32-04:00",
      bedtimeEnd: "2026-08-29T19:25:32-04:00",
    });
    const night = period({
      bedtimeStart: "2026-08-30T00:20:30-04:00",
      bedtimeEnd: "2026-08-30T09:00:06-04:00",
    });

    const nights = selectNightSleepByDay([afternoon, night]);

    expect(nights.get("2026-08-30")?.id).toBe(night.id);
    expect(nights.get("2026-08-30")?.bedtimeStart).toBe(night.bedtimeStart);
  });

  it("keeps a two-hour night that Oura typed as sleep", () => {
    const shortNight = period({
      day: "2026-10-01",
      type: "sleep",
      bedtimeStart: "2026-10-01T03:10:00-04:00",
      bedtimeEnd: "2026-10-01T05:40:00-04:00",
    });

    const night = selectNightSleepByDay([shortNight]).get("2026-10-01");

    expect(night?.id).toBe(shortNight.id);
    expect(night?.totalSleepDuration).toBe(8100);
  });

  it("does not turn a daytime nap or a brief doze into a night", () => {
    const nap = period({
      day: "2026-10-01",
      type: "sleep",
      bedtimeStart: "2026-10-01T13:00:00-04:00",
      bedtimeEnd: "2026-10-01T14:30:00-04:00",
    });
    const doze = period({
      day: "2026-10-02",
      type: "sleep",
      bedtimeStart: "2026-10-01T21:00:00-04:00",
      bedtimeEnd: "2026-10-01T21:30:00-04:00",
    });

    expect(selectNightSleepByDay([nap, doze]).size).toBe(0);
  });

  it("leaves an evening doze out of the night that follows it", () => {
    const doze = period({
      day: "2026-09-30",
      type: "sleep",
      bedtimeStart: "2026-09-29T19:37:27-04:00",
      bedtimeEnd: "2026-09-29T19:59:32-04:00",
      totalSleepDuration: 240,
    });
    const night = period({
      day: "2026-09-30",
      bedtimeStart: "2026-09-30T02:10:27-04:00",
      bedtimeEnd: "2026-09-30T07:54:31-04:00",
      totalSleepDuration: 18300,
    });

    const selected = selectNightSleepByDay([doze, night]).get("2026-09-30");

    expect(selected?.bedtimeStart).toBe(night.bedtimeStart);
    expect(selected?.totalSleepDuration).toBe(18300);
  });

  it("joins a night broken in two into one night", () => {
    const first = period({
      bedtimeStart: "2026-08-29T22:00:00-04:00",
      bedtimeEnd: "2026-08-30T01:30:00-04:00",
      totalSleepDuration: 12_000,
      timeInBed: 12_600,
      latency: 900,
    });
    const second = period({
      bedtimeStart: "2026-08-30T03:00:00-04:00",
      bedtimeEnd: "2026-08-30T06:30:00-04:00",
      totalSleepDuration: 12_300,
      timeInBed: 12_600,
      latency: 300,
    });

    const night = selectNightSleepByDay([second, first]).get("2026-08-30");

    expect(night?.id).toBe(second.id);
    expect(night?.bedtimeStart).toBe(first.bedtimeStart);
    expect(night?.bedtimeEnd).toBe(second.bedtimeEnd);
    expect(night?.totalSleepDuration).toBe(24_300);
    expect(night?.timeInBed).toBe(25_200);
    expect(night?.latency).toBe(900);
    expect(night?.efficiency).toBe(96);
  });

  it("falls back to a daytime long sleep when no night was recorded", () => {
    const daySleep = period({
      day: "2026-10-01",
      bedtimeStart: "2026-10-01T07:00:00-04:00",
      bedtimeEnd: "2026-10-01T15:00:00-04:00",
    });

    expect(selectNightSleepByDay([daySleep]).get("2026-10-01")?.id).toBe(
      daySleep.id
    );
  });

  it("ignores rest, late naps and deleted periods", () => {
    const rest = period({
      type: "rest",
      bedtimeStart: "2026-08-30T00:00:00-04:00",
      bedtimeEnd: "2026-08-30T06:00:00-04:00",
    });
    const deleted = period({
      type: "deleted",
      bedtimeStart: "2026-08-30T00:00:00-04:00",
      bedtimeEnd: "2026-08-30T06:00:00-04:00",
    });

    expect(selectNightSleepByDay([rest, deleted]).size).toBe(0);
  });
});

describe("combineNightPeriods", () => {
  it("returns a lone period unchanged", () => {
    const only = period({
      bedtimeStart: "2026-08-30T00:20:30-04:00",
      bedtimeEnd: "2026-08-30T09:00:06-04:00",
    });

    expect(combineNightPeriods([only])).toBe(only);
  });

  it("keeps stage sums present when one period lacks a stage", () => {
    const night = combineNightPeriods([
      period({
        bedtimeStart: "2026-08-29T23:00:00-04:00",
        bedtimeEnd: "2026-08-30T02:00:00-04:00",
        remSleepDuration: null,
      }),
      period({
        bedtimeStart: "2026-08-30T03:00:00-04:00",
        bedtimeEnd: "2026-08-30T07:00:00-04:00",
        remSleepDuration: 3600,
      }),
    ]);

    expect(night.remSleepDuration).toBe(3600);
  });
});
