import { describe, expect, it } from "vitest";
import { decideAlert, isLikelyBot } from "./visit-alert-policy";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1";

const BASE = {
  enabled: true,
  isAuthor: false,
  userAgent: IPHONE,
  lastAlertedAt: null as number | null,
  now: 1_800_000_000,
  windowMinutes: 30,
};

describe("isLikelyBot", () => {
  it("treats a missing user agent as a bot", () => {
    expect(isLikelyBot(null)).toBe(true);
  });

  it("flags common crawlers and tools", () => {
    expect(isLikelyBot("Googlebot/2.1")).toBe(true);
    expect(isLikelyBot("curl/8.4.0")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 ... HeadlessChrome/120")).toBe(true);
  });

  it("does not flag a real phone browser", () => {
    expect(isLikelyBot(IPHONE)).toBe(false);
  });
});

describe("decideAlert", () => {
  it("alerts on a fresh anonymous human visit", () => {
    expect(decideAlert(BASE)).toEqual({ alert: true, reason: null });
  });

  it("stays silent when alerts are disabled", () => {
    expect(decideAlert({ ...BASE, enabled: false })).toEqual({
      alert: false,
      reason: "disabled",
    });
  });

  it("does not alert you about your own visit", () => {
    expect(decideAlert({ ...BASE, isAuthor: true })).toEqual({
      alert: false,
      reason: "author",
    });
  });

  it("does not alert on bot traffic", () => {
    expect(decideAlert({ ...BASE, userAgent: "Googlebot/2.1" })).toEqual({
      alert: false,
      reason: "bot",
    });
  });

  it("throttles a repeat visit inside the window", () => {
    expect(
      decideAlert({ ...BASE, lastAlertedAt: BASE.now - 10 * 60 })
    ).toEqual({ alert: false, reason: "throttled" });
  });

  it("alerts again once the window has passed", () => {
    expect(
      decideAlert({ ...BASE, lastAlertedAt: BASE.now - 31 * 60 })
    ).toEqual({ alert: true, reason: null });
  });

  it("checks the author before the throttle so self-visits never queue", () => {
    expect(
      decideAlert({ ...BASE, isAuthor: true, lastAlertedAt: BASE.now - 90 * 60 })
    ).toEqual({ alert: false, reason: "author" });
  });
});
