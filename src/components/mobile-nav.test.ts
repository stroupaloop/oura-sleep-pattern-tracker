import { describe, expect, it } from "vitest";
import { isCurrentPath } from "./mobile-nav";

describe("isCurrentPath", () => {
  it("marks the page that is open", () => {
    expect(isCurrentPath("/dashboard/settings", "/dashboard/settings")).toBe(true);
    expect(isCurrentPath("/dashboard/health", "/dashboard/settings")).toBe(false);
  });

  it("keeps a section current on the pages inside it", () => {
    expect(isCurrentPath("/dashboard/sleep/2026-10-01", "/dashboard/sleep")).toBe(true);
    expect(isCurrentPath("/dashboard/sleepy", "/dashboard/sleep")).toBe(false);
  });

  it("marks Thoughts and the public page only on themselves", () => {
    expect(isCurrentPath("/dashboard", "/dashboard")).toBe(true);
    expect(isCurrentPath("/dashboard/health", "/dashboard")).toBe(false);
    expect(isCurrentPath("/dashboard", "/")).toBe(false);
    expect(isCurrentPath(null, "/dashboard")).toBe(false);
  });
});
