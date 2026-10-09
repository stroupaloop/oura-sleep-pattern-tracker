import { describe, expect, it } from "vitest";
import { describeCompositionSpan } from "./sleep-composition-bar";

describe("describeCompositionSpan", () => {
  it("names the first and last day the bars cover", () => {
    expect(
      describeCompositionSpan([
        { day: "2026-09-23" },
        { day: "2026-09-24" },
        { day: "2026-10-06" },
      ])
    ).toBe("Sep 23 – Oct 6");
  });

  it("names a single day once", () => {
    expect(describeCompositionSpan([{ day: "2026-10-06" }])).toBe("Oct 6");
  });

  it("has nothing to say without days", () => {
    expect(describeCompositionSpan([])).toBe("");
  });
});
