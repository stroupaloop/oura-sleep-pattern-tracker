import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HealthDashboardData } from "@/lib/health/health-dashboard-data";
import { buildNightStrip, type StripNight } from "@/lib/health/night-strip";
import { buildNightWindow } from "@/lib/health/night-window";
import type { Signal } from "@/lib/health/signals";
import { MissingNightNotice } from "./missing-night-notice";
import { NightPanel } from "./night-panel";
import { NightStripChart, stripNightLabel } from "./night-strip-chart";
import { NightWindowChart } from "./night-window-chart";
import { scoreBand } from "./score-panel";
import { SignalList } from "./signal-list";

describe("SignalList", () => {
  const signals: Signal[] = [
    {
      key: "sleep",
      label: "Sleep",
      value: "5h 5m",
      comparison: "1h 59m less than usual",
      usualValue: "7h 4m",
      z: -2.3,
      level: "unusual",
    },
    {
      key: "wake",
      label: "Wake",
      value: "7:30 AM",
      comparison: "About usual",
      usualValue: "7:32 AM",
      z: -0.1,
      level: "usual",
    },
  ];

  it("marks only threshold crossings as unusual, in words as well as color", () => {
    const html = renderToStaticMarkup(
      <SignalList signals={signals} threshold={1.5} />
    );
    expect(html.match(/>Unusual</g)).toHaveLength(1);
    expect(html).toContain("1h 59m less than usual");
    expect(html).toContain("usual 7h 4m");
    expect(html).not.toContain("usual 7:32 AM");
  });
});

describe("MissingNightNotice", () => {
  it("explains a morning gap and the way to close it", () => {
    const html = renderToStaticMarkup(
      <MissingNightNotice morning canSync hasEarlierNight />
    );
    expect(html).toContain("Last night isn&#x27;t here yet");
    expect(html).toContain("Then tap Sync now.");
    expect(html).toContain("Below is the latest night on record.");
  });

  it("calls a later gap unrecorded, without offering a button it lacks", () => {
    const html = renderToStaticMarkup(
      <MissingNightNotice morning={false} canSync={false} hasEarlierNight={false} />
    );
    expect(html).toContain("No sleep recorded for last night");
    expect(html).not.toContain("Sync now");
  });
});

describe("NightWindowChart", () => {
  it("describes the night in text for screen readers", () => {
    const window = buildNightWindow(
      [
        {
          bedtimeStart: "2026-09-30T02:10:00-04:00",
          bedtimeEnd: "2026-09-30T07:54:00-04:00",
          hypnogram5min: "2211",
        },
      ],
      { bedtimeMinutes: -15, wakeMinutes: 452 }
    )!;
    const html = renderToStaticMarkup(<NightWindowChart window={window} />);
    expect(html).toContain("Asleep from 2:10 AM to 7:54 AM.");
    expect(html).toContain("Usual window");
  });
});

describe("scoreBand", () => {
  it("uses Oura's score bands", () => {
    expect(scoreBand(85).label).toBe("Optimal");
    expect(scoreBand(84).label).toBe("Good");
    expect(scoreBand(69).label).toBe("Fair");
    expect(scoreBand(59).label).toBe("Pay attention");
  });
});

describe("NightStripChart", () => {
  function recorded(
    bed: string,
    wake: string,
    asleepMinutes: number,
    sleepZ: number
  ): StripNight {
    return {
      periods: [{ bedtimeStart: bed, bedtimeEnd: wake, hypnogram5min: null }],
      asleepMinutes,
      usual: {
        bedtimeMinutes: 23 * 60,
        wakeMinutes: 7 * 60,
        sleepMinutes: 420,
        sleepZ,
      },
    };
  }
  const nights: Record<string, StripNight> = {
    "2026-10-06": recorded("2026-10-05T23:00:00-04:00", "2026-10-06T07:00:00-04:00", 420, 0.1),
    "2026-10-05": recorded("2026-10-05T02:30:00-04:00", "2026-10-05T06:50:00-04:00", 240, -2.4),
    "2026-10-03": recorded("2026-10-02T23:10:00-04:00", "2026-10-03T07:05:00-04:00", 430, 0.2),
  };
  const days = ["2026-10-06", "2026-10-05", "2026-10-04", "2026-10-03"];
  const strip = buildNightStrip(days, (day) => nights[day] ?? null, 1.5)!;
  const html = renderToStaticMarkup(<NightStripChart strip={strip} />);

  it("names a night by the evening it starts, since Oura dates it by the morning", () => {
    expect(stripNightLabel("2026-10-06")).toBe("Mon night");
    expect(stripNightLabel("2026-10-04")).toBe("Sat night");
    for (const label of ["Mon night", "Sun night", "Sat night", "Fri night"]) {
      expect(html).toContain(`>${label}<`);
    }
  });

  it("leaves a night with nothing recorded as a row that says so", () => {
    expect(html.match(/No night recorded/g)).toHaveLength(1);
    expect(html.indexOf(">Sat night<")).toBeLessThan(html.indexOf("No night recorded"));
  });

  it("colors only the night whose sleep crossed the threshold, and says it in words", () => {
    expect(html.match(/text-attention/g)).toHaveLength(1);
    expect(html).toContain("3h 0m less");
    expect(html).toContain("unusual.");
  });

  it("describes every night in text for screen readers, newest first", () => {
    expect(html).toContain(
      "Mon night: asleep 11:00 PM to 7:00 AM, 7h 0m of sleep, about usual."
    );
    expect(html).toContain("Sat night: no night recorded.");
    expect(html.indexOf("Mon night: asleep")).toBeLessThan(
      html.indexOf("Fri night: asleep")
    );
  });

  it("explains the shaded band", () => {
    expect(html).toContain("Usual window");
  });
});

describe("NightPanel short-night run", () => {
  function panel(
    shortRun: HealthDashboardData["shortRun"],
    level: Signal["level"]
  ) {
    const data = {
      shownDay: "2026-10-06",
      isLastNight: true,
      night: {
        totalSleepSeconds: 20_400,
        timeInBedSeconds: 22_000,
        efficiency: 90,
        periodCount: 1,
        window: null,
      },
      signals: [
        {
          key: "sleep",
          label: "Sleep",
          value: "5h 40m",
          comparison: "1h 20m less than usual",
          usualValue: "7h 0m",
          z: level === "unusual" ? -2 : -1.2,
          level,
        },
      ],
      shortRun,
    } as unknown as HealthDashboardData;
    return renderToStaticMarkup(<NightPanel data={data} />);
  }

  it("says how many short nights in a row, and how much less sleep they added up to", () => {
    const html = panel({ nights: 3, minutesShort: 185, endedByGap: false }, "outside");
    expect(html).toContain(
      "3rd night in a row shorter than usual · 3h 5m less sleep in total"
    );
  });

  it("stays quiet about a single short night, which the comparison above already says", () => {
    const html = panel({ nights: 1, minutesShort: 80, endedByGap: false }, "outside");
    expect(html).not.toContain("in a row");
    expect(panel(null, "outside")).not.toContain("in a row");
  });

  it("turns amber only when the latest night itself crossed the threshold", () => {
    const quiet = panel({ nights: 2, minutesShort: 100, endedByGap: false }, "outside");
    const past = panel({ nights: 2, minutesShort: 160, endedByGap: false }, "unusual");
    expect(quiet.match(/text-attention/g)).toBeNull();
    expect(past.match(/text-attention/g)).toHaveLength(2);
  });
});
