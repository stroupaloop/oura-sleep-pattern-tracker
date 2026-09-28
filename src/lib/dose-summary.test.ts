import { describe, expect, it } from "vitest";
import { summarizeDoses } from "./dose-summary";

const MEDS = [
  { id: 1, name: "Lamotrigine", frequency: "daily", doseSchedule: '["morning"]', startDate: null, endDate: null },
  { id: 2, name: "Lithium", frequency: "daily", doseSchedule: '["evening"]', startDate: null, endDate: null },
  { id: 3, name: "Hydroxyzine", frequency: "as_needed", doseSchedule: null, startDate: null, endDate: null },
  { id: 4, name: "Stopped", frequency: "daily", doseSchedule: '["morning"]', startDate: null, endDate: "2026-09-01" },
  { id: 5, name: "Weekly", frequency: "weekly", doseSchedule: null, startDate: null, endDate: null },
];

describe("summarizeDoses", () => {
  it("splits scheduled doses by whether they were marked taken", () => {
    expect(
      summarizeDoses(MEDS, [{ medicationId: 1, slot: "morning", taken: 1 }], "2026-09-27")
    ).toEqual({ taken: ["Lamotrigine (Morning)"], notTaken: ["Lithium (Evening)"] });
  });

  it("lists as-needed doses only once taken and skips weekly and stopped ones", () => {
    expect(
      summarizeDoses(
        MEDS,
        [
          { medicationId: 3, slot: null, taken: 1 },
          { medicationId: 2, slot: "evening", taken: 0 },
        ],
        "2026-09-27"
      )
    ).toEqual({
      taken: ["Hydroxyzine"],
      notTaken: ["Lamotrigine (Morning)", "Lithium (Evening)"],
    });
  });
});
