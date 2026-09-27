import { describe, expect, it } from "vitest";
import {
  buildSignInAlert,
  shouldAlertSignIn,
  signInAlertsEnabled,
} from "./signin-alert";

const BASE = {
  email: "her@example.com",
  isNewUser: false,
  city: "New%20York%20City",
  region: "NY",
  country: "US",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
  createdAt: Date.parse("2026-09-27T23:05:10Z") / 1000,
};

describe("signInAlertsEnabled", () => {
  it("defaults to the production deployment only", () => {
    expect(signInAlertsEnabled({ vercelEnv: "production" })).toBe(true);
    expect(
      signInAlertsEnabled({ vercelEnv: "preview", nodeEnv: "production" })
    ).toBe(false);
    expect(signInAlertsEnabled({ nodeEnv: "development" })).toBe(false);
  });

  it("honours an explicit flag either way", () => {
    expect(signInAlertsEnabled({ flag: "0", vercelEnv: "production" })).toBe(
      false
    );
    expect(signInAlertsEnabled({ flag: "1", nodeEnv: "development" })).toBe(
      true
    );
  });
});

describe("shouldAlertSignIn", () => {
  it("alerts when someone other than an author signs in", () => {
    expect(
      shouldAlertSignIn({ enabled: true, email: BASE.email, isAuthor: false })
    ).toBe(true);
  });

  it("stays quiet for authors, a missing email, or when disabled", () => {
    expect(
      shouldAlertSignIn({
        enabled: true,
        email: "me@example.com",
        isAuthor: true,
      })
    ).toBe(false);
    expect(
      shouldAlertSignIn({ enabled: true, email: null, isAuthor: false })
    ).toBe(false);
    expect(
      shouldAlertSignIn({ enabled: false, email: BASE.email, isAuthor: false })
    ).toBe(false);
  });
});

describe("buildSignInAlert", () => {
  it("builds a returning sign-in alert in Eastern time", () => {
    const alert = buildSignInAlert(BASE);
    expect(alert.subject).toBe("🔑 her@example.com just signed in");
    expect(alert.html).toContain("New York City, NY, US");
    expect(alert.html).toContain("iPhone");
    expect(alert.html).toContain("Sep 27");
    expect(alert.html).toContain("7:05");
    expect(alert.text).toContain("Who: her@example.com");
    expect(alert.text).toContain("Device: iPhone");
  });

  it("calls out a first-ever sign-in", () => {
    const alert = buildSignInAlert({ ...BASE, isNewUser: true });
    expect(alert.subject).toBe(
      "🔑 her@example.com signed in for the first time"
    );
    expect(alert.text).toContain("for the first time");
  });

  it("escapes untrusted header values after decoding them", () => {
    const alert = buildSignInAlert({
      ...BASE,
      city: "%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    });
    expect(alert.html).not.toContain("<script>");
    expect(alert.html).toContain("&lt;script&gt;");
  });

  it("includes a site link only when one is given", () => {
    expect(buildSignInAlert(BASE).html).not.toContain("Open the site");
    const withSite = buildSignInAlert({
      ...BASE,
      siteUrl: "https://example.com",
    });
    expect(withSite.html).toContain("Open the site");
    expect(withSite.text).toContain("Open the site: https://example.com");
  });
});
