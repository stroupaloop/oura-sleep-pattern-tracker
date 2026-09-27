import { describe, expect, it } from "vitest";
import { nextBeaconPath } from "./visit-beacon";

describe("nextBeaconPath", () => {
  it("records the first page", () => {
    expect(nextBeaconPath(null, "/dashboard")).toBe("/dashboard");
  });

  it("skips the page it just recorded, so a re-run effect sends nothing", () => {
    expect(nextBeaconPath("/dashboard", "/dashboard")).toBeNull();
  });

  it("records each new page reached by navigation", () => {
    expect(nextBeaconPath("/dashboard", "/dashboard/health")).toBe(
      "/dashboard/health"
    );
    expect(nextBeaconPath("/dashboard/health", "/dashboard")).toBe(
      "/dashboard"
    );
  });
});
