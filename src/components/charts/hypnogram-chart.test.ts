import { describe, expect, it } from "vitest";
import { hourTicks, hypnogramIndexAt, hypnogramOffset } from "./hypnogram-chart";

describe("hypnogramIndexAt", () => {
  it("maps the pointer to the bar under it, past the heart-rate axis", () => {
    // 700px wide: 48px labels, 620px plot, 32px heart-rate axis; 96 bars.
    expect(hypnogramIndexAt(48, 700, 96, true)).toBe(0);
    expect(hypnogramIndexAt(667, 700, 96, true)).toBe(95);
    expect(hypnogramIndexAt(669, 700, 96, true)).toBeNull();
    expect(hypnogramIndexAt(40, 700, 96, true)).toBeNull();
  });

  it("uses the full width when there is no heart-rate axis", () => {
    expect(hypnogramIndexAt(699, 700, 96, false)).toBe(95);
    // 374px is the middle of the 652px plot.
    expect(hypnogramIndexAt(374, 700, 96, false)).toBe(48);
  });
});

describe("hypnogramOffset", () => {
  it("starts each bar at its share of the plot", () => {
    expect(hypnogramOffset(0, 100)).toBe(0);
    expect(hypnogramOffset(96, 100)).toBe(0.96);
    expect(hypnogramOffset(1, 0)).toBe(0);
  });
});

describe("hourTicks", () => {
  function samples(startHour: number, startMinute: number, count: number) {
    return Array.from({ length: count }, (_, index) => {
      const minutes = startHour * 60 + startMinute + index * 5;
      return {
        clock: { hour: Math.floor(minutes / 60) % 24, minute: minutes % 60 },
      };
    });
  }

  it("ticks the whole hours a short night crosses", () => {
    // 2:10 AM to 6:10 AM.
    expect(hourTicks(samples(2, 10, 48))).toEqual([
      { share: 50 / 240, label: "3 AM" },
      { share: 110 / 240, label: "4 AM" },
      { share: 170 / 240, label: "5 AM" },
      { share: 230 / 240, label: "6 AM" },
    ]);
  });

  it("ticks every other hour on a long night, across midnight", () => {
    // 10:30 PM to 7:30 AM.
    const ticks = hourTicks(samples(22, 30, 108)).map((tick) => tick.label);
    expect(ticks).toEqual(["12 AM", "2 AM", "4 AM", "6 AM"]);
  });

  it("skips samples without a clock time", () => {
    expect(hourTicks([{ clock: null }, { clock: null }])).toEqual([]);
  });
});
