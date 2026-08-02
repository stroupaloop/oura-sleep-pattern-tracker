import { describe, expect, it } from "vitest";
import { parseMoodWrite } from "./mood-write";

describe("parseMoodWrite", () => {
  it("keeps omitted fields out of a partial update", () => {
    expect(
      parseMoodWrite({ day: "2026-07-30", moodScore: 2 })
    ).toEqual({
      ok: true,
      day: "2026-07-30",
      fields: { moodScore: 2 },
    });
  });

  it("supports explicitly clearing notes, tags, and episode state", () => {
    expect(
      parseMoodWrite({
        day: "2026-07-30",
        notes: "",
        tags: [],
        episodeState: null,
      })
    ).toEqual({
      ok: true,
      day: "2026-07-30",
      fields: { notes: null, tags: null, episodeState: null },
    });
  });

  it("rejects out-of-range optional scores", () => {
    expect(
      parseMoodWrite({ day: "2026-07-30", energyScore: 9 })
    ).toEqual({
      ok: false,
      error: "energyScore must be null or an integer from 1 to 5",
    });
  });

  it("keeps mania distinct from hypomania for retrospective review", () => {
    expect(
      parseMoodWrite({ day: "2026-07-30", episodeState: "manic" })
    ).toEqual({
      ok: true,
      day: "2026-07-30",
      fields: { episodeState: "manic" },
    });
  });
});
