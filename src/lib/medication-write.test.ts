import { describe, expect, it } from "vitest";
import {
  getSupersededMedicationIds,
  parseMedicationCreate,
  parseMedicationUpdate,
  planMedicationUpdate,
  type MedicationRecord,
} from "./medication-write";

const TODAY = "2026-07-30";

function medication(
  overrides: Partial<MedicationRecord> = {}
): MedicationRecord {
  return {
    id: 7,
    name: "Lamotrigine",
    dosage: "100 mg",
    frequency: "daily",
    doseSchedule: '["morning"]',
    isActive: 1,
    startDate: "2026-01-01",
    endDate: null,
    previousVersionId: null,
    ...overrides,
  };
}

describe("parseMedicationCreate", () => {
  it("normalizes a valid scheduled medication", () => {
    expect(
      parseMedicationCreate(
        {
          name: "  Lamotrigine ",
          dosage: " 100 mg ",
          frequency: "twice_daily",
          doseSchedule: ["evening", "morning", "morning"],
          startDate: TODAY,
        },
        TODAY
      )
    ).toEqual({
      ok: true,
      value: {
        name: "Lamotrigine",
        dosage: "100 mg",
        frequency: "twice_daily",
        doseSchedule: '["morning","evening"]',
        isActive: 1,
        startDate: TODAY,
        endDate: null,
        previousVersionId: null,
      },
    });
  });

  it("rejects an impossible start date", () => {
    expect(
      parseMedicationCreate(
        { name: "Lamotrigine", startDate: "2026-02-30" },
        TODAY
      )
    ).toEqual({
      ok: false,
      error:
        "startDate must be a real calendar day in YYYY-MM-DD format or null",
    });
  });

  it("requires null schedule semantics for as-needed medication", () => {
    expect(
      parseMedicationCreate(
        {
          name: "Rescue medication",
          frequency: "as_needed",
          doseSchedule: ["morning"],
        },
        TODAY
      )
    ).toEqual({
      ok: false,
      error: "doseSchedule must be null for an as-needed medication",
    });
  });
});

describe("parseMedicationUpdate", () => {
  it.each([0, -1, 1.5, "7", Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid id %j",
    (id) => {
      expect(parseMedicationUpdate({ id, dosage: "150 mg" })).toEqual({
        ok: false,
        error: "id must be a positive integer",
      });
    }
  );

  it.each([0, 1, "true", null])(
    "rejects non-boolean isActive %j",
    (isActive) => {
      expect(parseMedicationUpdate({ id: 7, isActive })).toEqual({
        ok: false,
        error: "isActive must be a boolean",
      });
    }
  );

  it("rejects an impossible end date", () => {
    expect(
      parseMedicationUpdate({ id: 7, endDate: "2026-04-31" })
    ).toEqual({
      ok: false,
      error: "endDate must be a real calendar day in YYYY-MM-DD format or null",
    });
  });
});

describe("planMedicationUpdate", () => {
  it("closes today's regimen and starts a material edit tomorrow", () => {
    expect(
      planMedicationUpdate(
        medication(),
        {
          id: 7,
          dosage: "150 mg",
          frequency: "twice_daily",
          doseSchedule: ["morning", "evening"],
        },
        TODAY
      )
    ).toEqual({
      ok: true,
      kind: "version",
      closeUpdates: { isActive: 0, endDate: TODAY },
      createValues: {
        name: "Lamotrigine",
        dosage: "150 mg",
        frequency: "twice_daily",
        doseSchedule: '["morning","evening"]',
        isActive: 1,
        startDate: "2026-07-31",
        endDate: null,
        previousVersionId: 7,
      },
    });
  });

  it("does not create a version for a semantic no-op", () => {
    expect(
      planMedicationUpdate(
        medication(),
        {
          id: 7,
          dosage: "100 mg",
          frequency: "daily",
          doseSchedule: ["morning"],
          startDate: "2026-01-01",
        },
        TODAY
      )
    ).toEqual({ ok: true, kind: "noop" });
  });

  it("updates an already-future version in place", () => {
    expect(
      planMedicationUpdate(
        medication({ startDate: "2026-07-31" }),
        { id: 7, dosage: "200 mg" },
        TODAY
      )
    ).toEqual({
      ok: true,
      kind: "update",
      updates: {
        name: "Lamotrigine",
        dosage: "200 mg",
        frequency: "daily",
        doseSchedule: '["morning"]',
      },
    });
  });

  it("reactivates as a new period without changing the prior period", () => {
    expect(
      planMedicationUpdate(
        medication({ isActive: 0, endDate: "2026-07-10" }),
        { id: 7, isActive: true, endDate: null },
        TODAY
      )
    ).toEqual({
      ok: true,
      kind: "version",
      closeUpdates: null,
      createValues: {
        name: "Lamotrigine",
        dosage: "100 mg",
        frequency: "daily",
        doseSchedule: '["morning"]',
        isActive: 1,
        startDate: TODAY,
        endDate: null,
        previousVersionId: 7,
      },
    });
  });

  it("starts tomorrow when reactivating a period that ends today", () => {
    const plan = planMedicationUpdate(
      medication({ isActive: 0, endDate: TODAY }),
      { id: 7, isActive: true, endDate: null },
      TODAY
    );

    expect(plan.ok && plan.kind === "version" && plan.createValues.startDate).toBe(
      "2026-07-31"
    );
  });

  it("blocks reactivation after a historical row already has a successor", () => {
    expect(
      planMedicationUpdate(
        medication({ isActive: 0, endDate: "2026-07-10" }),
        { id: 7, isActive: true, endDate: null },
        TODAY,
        true
      )
    ).toEqual({
      ok: false,
      error: "This historical medication version has already been superseded",
      status: 409,
    });
  });

  it("cancels an unstarted successor so its predecessor can be restored", () => {
    expect(
      planMedicationUpdate(
        medication({
          startDate: "2026-07-31",
          previousVersionId: 3,
        }),
        { id: 7, isActive: false, endDate: TODAY },
        TODAY
      )
    ).toEqual({
      ok: true,
      kind: "cancel-future-version",
      predecessorId: 3,
    });
  });

  it("changes inactive period metadata without creating a version", () => {
    expect(
      planMedicationUpdate(
        medication({ isActive: 0, endDate: "2026-07-10" }),
        { id: 7, endDate: "2026-07-12" },
        TODAY
      )
    ).toEqual({
      ok: true,
      kind: "update",
      updates: { endDate: "2026-07-12" },
    });
  });
});

describe("getSupersededMedicationIds", () => {
  it("identifies predecessor rows while retaining unrelated history", () => {
    expect(
      getSupersededMedicationIds([
        medication({ id: 1 }),
        medication({ id: 2, previousVersionId: 1 }),
        medication({ id: 3, isActive: 0 }),
      ])
    ).toEqual(new Set([1]));
  });
});
