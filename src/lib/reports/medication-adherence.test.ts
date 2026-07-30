import { describe, expect, it } from "vitest";
import { summarizeRecordedMedicationLogs } from "./medication-adherence";

describe("summarizeRecordedMedicationLogs", () => {
  it("uses only explicitly recorded scheduled doses as the denominator", () => {
    const result = summarizeRecordedMedicationLogs(
      [{ id: 1, name: "Scheduled", frequency: "twice_daily" }],
      [
        { medicationId: 1, day: "2026-07-01", slot: "morning", taken: 1 },
        { medicationId: 1, day: "2026-07-01", slot: "evening", taken: 0 },
      ]
    );

    expect(result).toEqual([
      {
        name: "Scheduled",
        taken: 1,
        total: 2,
        rate: 0.5,
        asNeeded: false,
        unclassifiedLegacyRecords: 0,
      },
    ]);
  });

  it("does not treat missing or unscheduled records as missed scheduled doses", () => {
    const result = summarizeRecordedMedicationLogs(
      [
        { id: 1, name: "Scheduled", frequency: "daily" },
        { id: 2, name: "No records", frequency: "daily" },
      ],
      [{ medicationId: 1, day: "2026-07-01", slot: null, taken: 0 }]
    );

    expect(result).toEqual([
      {
        name: "Scheduled",
        taken: 0,
        total: 0,
        rate: 0,
        asNeeded: false,
        unclassifiedLegacyRecords: 1,
      },
    ]);
  });

  it("reports as-needed use without treating it as scheduled adherence", () => {
    const result = summarizeRecordedMedicationLogs(
      [{ id: 3, name: "PRN", frequency: "as_needed" }],
      [
        { medicationId: 3, day: "2026-07-01", slot: null, taken: 1 },
        { medicationId: 3, day: "2026-07-02", slot: null, taken: 0 },
        { medicationId: 3, day: "2026-07-01", slot: "morning", taken: 1 },
        { medicationId: 3, day: "2026-06-30", slot: "morning", taken: 1 },
      ]
    );

    expect(result).toEqual([
      {
        name: "PRN",
        taken: 2,
        total: 3,
        rate: 2 / 3,
        asNeeded: true,
        unclassifiedLegacyRecords: 2,
      },
    ]);
  });

  it("does not treat unsupported weekly medication as a daily schedule", () => {
    expect(
      summarizeRecordedMedicationLogs(
        [{ id: 4, name: "Weekly", frequency: "weekly" }],
        [
          {
            medicationId: 4,
            day: "2026-07-01",
            slot: "morning",
            taken: 1,
          },
        ]
      )
    ).toEqual([]);
  });
});
