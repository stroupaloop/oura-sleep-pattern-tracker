import { describe, expect, it } from "vitest";
import { parseMoodWrite } from "./mood-write";
import {
  OPTIONAL_SCORES,
  changedOptionalScores,
  optionalScoresOf,
  type OptionalScores,
} from "./optional-scores";

const NONE = optionalScoresOf(null);
const SAVED: OptionalScores = {
  energyScore: 4,
  irritabilityScore: 2,
  anxietyScore: null,
  sleepSubjective: 5,
};

/** What the check-in posts: the day's answers plus only the scores that changed. */
function postedBody(current: OptionalScores, saved: OptionalScores) {
  return JSON.parse(
    JSON.stringify({
      day: "2026-01-15",
      moodScore: 1,
      ...changedOptionalScores(current, saved),
      notes: null,
      tags: [],
      episodeState: null,
    })
  );
}

/** What the server then writes: a field that is missing is left as it is. */
function writtenFields(current: OptionalScores, saved: OptionalScores) {
  const parsed = parseMoodWrite(postedBody(current, saved));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.fields;
}

describe("optionalScoresOf", () => {
  it("reads no entry as nothing answered", () => {
    expect(optionalScoresOf(null)).toEqual({
      energyScore: null,
      irritabilityScore: null,
      anxietyScore: null,
      sleepSubjective: null,
    });
    expect(optionalScoresOf(undefined)).toEqual(NONE);
  });

  it("keeps the answers an entry has and reads the rest as unanswered", () => {
    expect(
      optionalScoresOf({ energyScore: 4, sleepSubjective: 2, anxietyScore: null })
    ).toEqual({
      energyScore: 4,
      irritabilityScore: null,
      anxietyScore: null,
      sleepSubjective: 2,
    });
  });
});

describe("changedOptionalScores", () => {
  it("sends none when the optional section was opened and nothing was touched", () => {
    expect(changedOptionalScores(NONE, NONE)).toEqual({});
    const body = postedBody(NONE, NONE);
    for (const { key } of OPTIONAL_SCORES) expect(body).not.toHaveProperty(key);
    expect(writtenFields(NONE, NONE)).not.toHaveProperty("energyScore");
    expect(Object.keys(writtenFields(NONE, NONE))).toEqual([
      "moodScore",
      "notes",
      "tags",
      "episodeState",
    ]);
  });

  it("sends only the slider that was touched", () => {
    const touched = { ...NONE, irritabilityScore: 2 };
    expect(changedOptionalScores(touched, NONE)).toEqual({ irritabilityScore: 2 });
    expect(writtenFields(touched, NONE)).toMatchObject({ irritabilityScore: 2 });
    expect(writtenFields(touched, NONE)).not.toHaveProperty("energyScore");
    expect(writtenFields(touched, NONE)).not.toHaveProperty("anxietyScore");
    expect(writtenFields(touched, NONE)).not.toHaveProperty("sleepSubjective");
  });

  it("leaves a saved entry's values alone when they are not touched", () => {
    expect(changedOptionalScores(SAVED, SAVED)).toEqual({});
    const fields = writtenFields(SAVED, SAVED);
    for (const { key } of OPTIONAL_SCORES) expect(fields).not.toHaveProperty(key);
  });

  it("sends only the saved score that was moved", () => {
    expect(
      changedOptionalScores({ ...SAVED, energyScore: 2 }, SAVED)
    ).toEqual({ energyScore: 2 });
    expect(
      changedOptionalScores({ ...SAVED, anxietyScore: 3 }, SAVED)
    ).toEqual({ anxietyScore: 3 });
  });

  it("sends null to clear one saved score and nothing for the others", () => {
    const cleared = { ...SAVED, energyScore: null };
    expect(changedOptionalScores(cleared, SAVED)).toEqual({ energyScore: null });
    const fields = writtenFields(cleared, SAVED);
    expect(fields.energyScore).toBeNull();
    expect(fields).not.toHaveProperty("irritabilityScore");
    expect(fields).not.toHaveProperty("sleepSubjective");
  });

  it("compares with what was last saved, so a second save does not repeat it", () => {
    const afterFirstSave = { ...NONE, energyScore: 4 };
    expect(changedOptionalScores(afterFirstSave, afterFirstSave)).toEqual({});
    expect(
      changedOptionalScores({ ...afterFirstSave, energyScore: null }, afterFirstSave)
    ).toEqual({ energyScore: null });
  });

  it("uses the keys the server takes, and lets it set or clear each one", () => {
    expect(OPTIONAL_SCORES.map(({ key }) => key)).toEqual(Object.keys(NONE));
    for (const { key } of OPTIONAL_SCORES) {
      expect(parseMoodWrite({ day: "2026-01-15", [key]: 3 })).toMatchObject({
        ok: true,
        fields: { [key]: 3 },
      });
      expect(parseMoodWrite({ day: "2026-01-15", [key]: null })).toMatchObject({
        ok: true,
        fields: { [key]: null },
      });
    }
  });
});

describe("OPTIONAL_SCORES", () => {
  it("names what each end means, since 5 is good for sleep and not for anxiety", () => {
    expect(
      OPTIONAL_SCORES.map(({ label, low, high }) => `${label}: ${low} to ${high}`)
    ).toEqual([
      "Energy: Low to High",
      "Irritability: None to A lot",
      "Anxiety: None to A lot",
      "Sleep quality: Poor to Great",
    ]);
  });
});
