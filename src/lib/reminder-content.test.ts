import { describe, expect, it } from "vitest";
import { buildReminder, dueSlotsAt } from "./reminder-content";

describe("dueSlotsAt", () => {
  it("only counts slots whose time has come", () => {
    expect([...dueSlotsAt(11)]).toEqual(["morning"]);
    expect([...dueSlotsAt(22)]).toEqual(["morning", "afternoon", "evening", "night"]);
  });
});

describe("buildReminder", () => {
  it("sends nothing when doses are logged and the day is checked in", () => {
    expect(buildReminder([], true, "u")).toBeNull();
  });

  it("leads with the missing meds", () => {
    const r = buildReminder(["Lithium (Morning)"], true, "u");
    expect(r?.subject).toMatch(/meds/);
    expect(r?.text).toContain("Lithium (Morning)");
    expect(r?.text).not.toContain("check-in");
  });

  it("still nudges the check-in when meds are done", () => {
    const r = buildReminder([], false, "u");
    expect(r?.subject).toBe("Time for today's daily log");
    expect(r?.text).toContain("check-in");
  });
});
