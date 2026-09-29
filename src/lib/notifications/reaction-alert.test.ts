import { describe, expect, it } from "vitest";
import { buildReactionAlert } from "./reaction-alert";
import { reactionAlertsEnabled } from "./reaction-notify";

// Tue Sep 29 2026, 2:14 PM EDT.
const WHEN = Date.parse("2026-09-29T18:14:00Z") / 1000;

describe("buildReactionAlert", () => {
  it("names one reaction to a ping", () => {
    const alert = buildReactionAlert({
      email: "reader@example.com",
      reactions: [{ emoji: "❤️", note: null, link: null, createdAt: WHEN }],
    });
    expect(alert.subject).toBe("❤️ reader@example.com reacted to your thought");
    expect(alert.text).toContain('❤️  "Thought of you" (Tue, Sep 29, 2:14 PM)');
  });

  it("groups several reactions and describes notes and links", () => {
    const alert = buildReactionAlert({
      email: "reader@example.com",
      reactions: [
        { emoji: "🥰", note: "miss <you>", link: null, createdAt: WHEN },
        {
          emoji: "😂",
          note: null,
          link: "https://www.youtube.com/watch?v=x",
          createdAt: WHEN,
        },
      ],
      siteUrl: "https://example.com",
    });
    expect(alert.subject).toBe(
      "🥰😂 reader@example.com reacted to 2 of your thoughts"
    );
    expect(alert.text).toContain('your note "miss <you>"');
    expect(alert.text).toContain("your youtube.com link");
    expect(alert.html).toContain("miss &lt;you&gt;");
    expect(alert.html).not.toContain("<you>");
    expect(alert.text.endsWith("https://example.com")).toBe(true);
  });

  it("trims a long note", () => {
    const alert = buildReactionAlert({
      email: "reader@example.com",
      reactions: [
        { emoji: "🥹", note: "y".repeat(300), link: null, createdAt: WHEN },
      ],
    });
    expect(alert.text).toContain(`"${"y".repeat(80)}…"`);
  });
});

describe("reactionAlertsEnabled", () => {
  it("is on in production only, unless the flag forces it", () => {
    expect(reactionAlertsEnabled({ vercelEnv: "production" })).toBe(true);
    expect(reactionAlertsEnabled({ vercelEnv: "preview" })).toBe(false);
    expect(reactionAlertsEnabled({ vercelEnv: "production", flag: "0" })).toBe(false);
    expect(reactionAlertsEnabled({ vercelEnv: "preview", flag: "1" })).toBe(true);
  });
});
