import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildNightWindow } from "@/lib/health/night-window";
import type { Signal } from "@/lib/health/signals";
import { MissingNightNotice } from "./missing-night-notice";
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
