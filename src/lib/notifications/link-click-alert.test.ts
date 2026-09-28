import { describe, expect, it } from "vitest";
import { buildLinkClickAlert, linkHost } from "./link-click-alert";

const BASE = {
  email: "reader@example.com",
  link: "https://www.youtube.com/watch?v=abc",
  note: "Thought you'd like <this> one",
  writtenAt: Date.parse("2026-09-27T14:00:00Z") / 1000,
  clickedAt: Date.parse("2026-09-28T12:30:00Z") / 1000,
  clickNumber: 1,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
  siteUrl: "https://example.com",
};

describe("buildLinkClickAlert", () => {
  it("names the reader, the site and that it is the first open", () => {
    const alert = buildLinkClickAlert(BASE);
    expect(alert.subject).toBe(
      "🔗 reader@example.com opened your youtube.com link (first time)"
    );
    expect(alert.text).toContain("Link: https://www.youtube.com/watch?v=abc");
    expect(alert.text).toContain("Device: iPhone");
    expect(alert.text).toContain("Times opened: 1");
  });

  it("counts repeat opens", () => {
    const alert = buildLinkClickAlert({ ...BASE, clickNumber: 3 });
    expect(alert.subject).toContain("(3rd time)");
    expect(alert.text).toContain("Times opened: 3");
  });

  it("escapes the note in HTML and trims a long one", () => {
    const alert = buildLinkClickAlert(BASE);
    expect(alert.html).toContain("Thought you'd like &lt;this&gt; one");
    expect(alert.html).not.toContain("<this>");

    const long = buildLinkClickAlert({ ...BASE, note: "x".repeat(500) });
    expect(long.text).toContain(`Note: ${"x".repeat(200)}…`);
  });

  it("leaves the note row out when there is no note", () => {
    const alert = buildLinkClickAlert({ ...BASE, note: "  " });
    expect(alert.text).not.toContain("Note:");
  });
});

describe("linkHost", () => {
  it("drops www and falls back for an unparseable link", () => {
    expect(linkHost("https://www.nytimes.com/a")).toBe("nytimes.com");
    expect(linkHost("not a url")).toBe("link");
  });
});
