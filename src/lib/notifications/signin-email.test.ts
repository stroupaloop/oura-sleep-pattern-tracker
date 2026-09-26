import { describe, expect, it } from "vitest";
import { buildSignInEmail } from "./signin-email";

const URL_ = "https://www.example.com/api/auth/callback/resend?token=abc&email=a%40b.c";

describe("buildSignInEmail", () => {
  it("names the host in the subject", () => {
    const mail = buildSignInEmail({ url: URL_, host: "www.example.com" });
    expect(mail.subject).toBe("Your sign-in link for www.example.com");
  });

  it("always ships a plain-text alternative containing the link", () => {
    const mail = buildSignInEmail({ url: URL_, host: "www.example.com" });
    expect(mail.text).toContain(URL_);
    expect(mail.text.length).toBeGreaterThan(100);
  });

  it("shows the destination as readable text, not only as a button", () => {
    const mail = buildSignInEmail({ url: URL_, host: "www.example.com" });
    // Once in the href, once shown as copyable text.
    const occurrences = mail.html.split("token=abc").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("escapes the host and url", () => {
    const mail = buildSignInEmail({
      url: "https://x.test/?a=1&b=2",
      host: '<script>alert(1)</script>',
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("a=1&amp;b=2");
  });

  it("describes expiry in hours for long windows", () => {
    const mail = buildSignInEmail({
      url: URL_,
      host: "h",
      expiresInMinutes: 24 * 60,
    });
    expect(mail.text).toContain("24 hours");
  });

  it("describes expiry in minutes for short windows", () => {
    const mail = buildSignInEmail({
      url: URL_,
      host: "h",
      expiresInMinutes: 30,
    });
    expect(mail.text).toContain("30 minutes");
  });

  it("tells the reader what to do if they did not request it", () => {
    const mail = buildSignInEmail({ url: URL_, host: "h" });
    expect(mail.text.toLowerCase()).toContain("did not ask");
    expect(mail.html.toLowerCase()).toContain("did not ask");
  });
});
