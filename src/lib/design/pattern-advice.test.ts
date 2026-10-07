import { describe, expect, it } from "vitest";
import { describePatternAdvice } from "./pattern-advice";

describe("describePatternAdvice", () => {
  it("keeps a higher-activation pattern's own suggestions", () => {
    expect(describePatternAdvice("hyper")).toEqual([
      "Track your mood and energy levels today",
      "Maintain your regular bedtime tonight",
      "Reach out to your care team if you notice changes",
    ]);
  });

  it("offers a lower-activation pattern's activity only as something to do if she feels up to it", () => {
    const advice = describePatternAdvice("hypo");
    expect(advice).toEqual([
      "Try to maintain regular sleep and wake times",
      "If you feel up to it, consider light physical activity today",
      "Reach out to your care team if you notice changes",
    ]);
    expect(advice.join(" ")).not.toContain("Consider light physical activity");
  });

  it("gives a pattern with no clear direction the neutral set, with nothing about activity", () => {
    const neutral = [
      "Log today's mood and any medications",
      "Keep tonight's bedtime and wake time close to your usual",
      "If this keeps going, or you feel different, talk with your care team",
    ];
    for (const direction of ["mixed", null, undefined, "sideways"]) {
      const advice = describePatternAdvice(direction);
      expect(advice).toEqual(neutral);
      expect(advice.join(" ")).not.toMatch(/activity|exercise/i);
    }
  });

  it("closes every set by pointing to her care team", () => {
    for (const direction of ["hyper", "hypo", "mixed", null]) {
      expect(describePatternAdvice(direction).at(-1)).toMatch(/care team/);
    }
  });
});
