import { describe, expect, it } from "vitest";
import { MAX_NOTE_LENGTH, parseThoughtWrite } from "./thoughts-write";

describe("parseThoughtWrite", () => {
  it("accepts a bare quick tap with no fields", () => {
    expect(parseThoughtWrite({})).toEqual({
      ok: true,
      fields: { kind: "thought", note: null, link: null },
    });
  });

  it("accepts a note with an Instagram reel link", () => {
    expect(
      parseThoughtWrite({
        note: "  this one made me laugh  ",
        link: "https://www.instagram.com/reel/abc123/",
      })
    ).toEqual({
      ok: true,
      fields: {
        kind: "thought",
        note: "this one made me laugh",
        link: "https://www.instagram.com/reel/abc123/",
      },
    });
  });

  it("treats blank strings as absent rather than empty content", () => {
    const result = parseThoughtWrite({ note: "   ", link: "" });
    expect(result).toEqual({
      ok: true,
      fields: { kind: "thought", note: null, link: null },
    });
  });

  it("accepts the miss kind", () => {
    const result = parseThoughtWrite({ kind: "miss" });
    expect(result.ok && result.fields.kind).toBe("miss");
  });

  it("rejects an unknown kind", () => {
    expect(parseThoughtWrite({ kind: "yearning" })).toEqual({
      ok: false,
      error: "kind must be one of: thought, miss",
    });
  });

  it("rejects a non-http link scheme", () => {
    expect(parseThoughtWrite({ link: "javascript:alert(1)" })).toEqual({
      ok: false,
      error: "link must be a valid http(s) URL",
    });
  });

  it("rejects a link that is not a URL at all", () => {
    expect(parseThoughtWrite({ link: "instagram reel" })).toEqual({
      ok: false,
      error: "link must be a valid http(s) URL",
    });
  });

  it("rejects an over-length note", () => {
    const result = parseThoughtWrite({ note: "x".repeat(MAX_NOTE_LENGTH + 1) });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    expect(parseThoughtWrite("nope")).toEqual({
      ok: false,
      error: "Invalid request body",
    });
    expect(parseThoughtWrite([]).ok).toBe(false);
    expect(parseThoughtWrite(null).ok).toBe(false);
  });
});
