import { describe, expect, it } from "vitest";
import { formatOptionalScores } from "./daily-log-format";

const NONE = {
  energyScore: null,
  irritabilityScore: null,
  anxietyScore: null,
  sleepSubjective: null,
};

describe("formatOptionalScores", () => {
  it("lists nothing when none of the optional scores were answered", () => {
    expect(formatOptionalScores(NONE)).toEqual([]);
  });

  it("lists only the answered scores, whichever ones they are", () => {
    expect(formatOptionalScores({ ...NONE, irritabilityScore: 2 })).toEqual([
      "Irritability 2/5",
    ]);
    expect(
      formatOptionalScores({ ...NONE, anxietyScore: 5, sleepSubjective: 1 })
    ).toEqual(["Anxiety 5/5", "Sleep quality 1/5"]);
  });

  it("lists all four in a fixed order when all were answered", () => {
    expect(
      formatOptionalScores({
        sleepSubjective: 4,
        anxietyScore: 3,
        irritabilityScore: 2,
        energyScore: 1,
      })
    ).toEqual([
      "Energy 1/5",
      "Irritability 2/5",
      "Anxiety 3/5",
      "Sleep quality 4/5",
    ]);
  });
});
