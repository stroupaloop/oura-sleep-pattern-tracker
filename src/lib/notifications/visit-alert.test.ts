import { describe, expect, it } from "vitest";
import {
  buildVisitAlert,
  describeDevice,
  describeLocation,
  describeVisitor,
  ordinal,
  shortVisitorId,
} from "./visit-alert";

const BASE = {
  email: null as string | null,
  isAuthed: false,
  visitorId: "a4f9c1d2-1111-2222-3333-444455556666",
  visitNumber: 1,
  path: "/",
  city: "Brooklyn",
  region: "NY",
  country: "US",
  referrer: null as string | null,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
  createdAt: Date.parse("2026-09-25T18:30:00Z") / 1000,
};

describe("shortVisitorId", () => {
  it("takes the first four hex characters", () => {
    expect(shortVisitorId(BASE.visitorId)).toBe("a4f9");
  });
});

describe("describeDevice", () => {
  it("recognises common platforms", () => {
    expect(describeDevice(BASE.userAgent)).toBe("iPhone");
    expect(describeDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toBe("Mac");
    expect(describeDevice("Mozilla/5.0 (Linux; Android 14)")).toBe("Android");
    expect(describeDevice(null)).toBe("Unknown device");
  });
});

describe("describeLocation", () => {
  it("joins the parts it has", () => {
    expect(describeLocation(BASE)).toBe("Brooklyn, NY, US");
    expect(
      describeLocation({ city: null, region: null, country: "US" })
    ).toBe("US");
  });

  it("falls back when geo headers are absent", () => {
    expect(
      describeLocation({ city: null, region: null, country: null })
    ).toBe("Unknown location");
  });

  it("decodes the percent-encoded city Vercel sends", () => {
    expect(
      describeLocation({ city: "Jersey%20City", region: "NJ", country: "US" })
    ).toBe("Jersey City, NJ, US");
  });

  it("keeps a value that is not valid percent-encoding", () => {
    expect(
      describeLocation({ city: "100%", region: null, country: null })
    ).toBe("100%");
  });
});

describe("ordinal", () => {
  it("handles the teens and the common suffixes", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
  });
});

describe("describeVisitor", () => {
  it("names a signed-in visitor by email", () => {
    expect(
      describeVisitor({ ...BASE, isAuthed: true, email: "her@example.com" })
    ).toBe("her@example.com");
  });

  it("falls back to a short anonymous handle", () => {
    expect(describeVisitor(BASE)).toBe("Anonymous #a4f9");
  });
});

describe("buildVisitAlert", () => {
  it("builds an anonymous first-visit alert", () => {
    const alert = buildVisitAlert(BASE);
    expect(alert.subject).toBe(
      "🦥 Someone's on the site — Anonymous #a4f9 (first visit)"
    );
    expect(alert.html).toContain("Brooklyn, NY, US");
    expect(alert.html).toContain("iPhone");
    expect(alert.html).toContain("direct");
  });

  it("names a signed-in visitor and their visit number", () => {
    const alert = buildVisitAlert({
      ...BASE,
      isAuthed: true,
      email: "her@example.com",
      visitNumber: 3,
    });
    expect(alert.subject).toBe("🦥 her@example.com is on the site (3rd visit)");
    expect(alert.html).toContain("her@example.com");
  });

  it("escapes untrusted header values", () => {
    const alert = buildVisitAlert({
      ...BASE,
      referrer: '"><script>alert(1)</script>',
    });
    expect(alert.html).not.toContain("<script>");
    expect(alert.html).toContain("&lt;script&gt;");
  });

  it("includes a site link only when one is given", () => {
    expect(buildVisitAlert(BASE).html).not.toContain("Open the site");
    expect(
      buildVisitAlert({ ...BASE, siteUrl: "https://example.com" }).html
    ).toContain("Open the site");
  });
});
