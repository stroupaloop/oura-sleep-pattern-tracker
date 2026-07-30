import { describe, expect, it } from "vitest";
import {
  classifyMedicationLogsForEditing,
  parseMedicationLogRange,
  parseMedicationLogWrite,
} from "./medication-log";

describe("classifyMedicationLogsForEditing", () => {
  it("keeps current slot semantics editable and isolates ambiguous legacy rows", () => {
    const result = classifyMedicationLogsForEditing(
      [
        { id: 1, frequency: "daily" },
        { id: 2, frequency: "as_needed" },
      ],
      [
        { medicationId: 1, slot: "morning", taken: 1 },
        { medicationId: 1, slot: null, taken: 1 },
        { medicationId: 2, slot: null, taken: 0 },
        { medicationId: 2, slot: "morning", taken: 1 },
      ]
    );

    expect(result).toEqual({
      editableLogs: [
        { medicationId: 1, slot: "morning", taken: 1 },
        { medicationId: 2, slot: null, taken: 0 },
      ],
      unclassifiedLegacyCount: 2,
    });
  });
});

describe("parseMedicationLogWrite", () => {
  it("accepts a valid scheduled or as-needed entry", () => {
    expect(
      parseMedicationLogWrite({
        medicationId: 3,
        day: "2026-07-30",
        taken: false,
        slot: "night",
      })
    ).toEqual({
      ok: true,
      medicationId: 3,
      day: "2026-07-30",
      taken: false,
      slot: "night",
    });

    expect(
      parseMedicationLogWrite({
        medicationId: 3,
        day: "2026-07-30",
        taken: true,
        slot: null,
      })
    ).toMatchObject({ ok: true, slot: null });
  });

  it.each([
    [{ medicationId: "3", day: "2026-07-30", taken: true }, "medicationId"],
    [{ medicationId: 0, day: "2026-07-30", taken: true }, "medicationId"],
    [{ medicationId: 3, day: "2026-02-30", taken: true }, "day"],
    [{ medicationId: 3, day: "2026-07-30", taken: "false" }, "taken"],
    [
      {
        medicationId: 3,
        day: "2026-07-30",
        taken: true,
        slot: "breakfast",
      },
      "slot",
    ],
  ])("rejects malformed input %#", (input, field) => {
    const parsed = parseMedicationLogWrite(input);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain(field);
  });
});

describe("parseMedicationLogRange", () => {
  it("accepts an absent or ordered valid range", () => {
    expect(parseMedicationLogRange(null, null)).toEqual({
      ok: true,
      start: null,
      end: null,
    });
    expect(
      parseMedicationLogRange("2026-07-01", "2026-07-30")
    ).toMatchObject({ ok: true });
  });

  it("rejects invalid and reversed ranges", () => {
    expect(parseMedicationLogRange("2026-02-30", null).ok).toBe(false);
    expect(parseMedicationLogRange(null, "2026-13-01").ok).toBe(false);
    expect(
      parseMedicationLogRange("2026-07-30", "2026-07-01")
    ).toEqual({ ok: false, error: "start must be on or before end" });
  });
});
