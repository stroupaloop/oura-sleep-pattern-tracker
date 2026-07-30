import { DOSE_SLOTS, type DoseSlot } from "@/lib/medication-schedule";
import { shiftIsoDay } from "@/lib/date-utils";

export type ParsedMedicationLogWrite =
  | {
      ok: true;
      medicationId: number;
      day: string;
      taken: boolean;
      slot: DoseSlot | null;
    }
  | { ok: false; error: string };

export type ParsedMedicationLogRange =
  | { ok: true; start: string | null; end: string | null }
  | { ok: false; error: string };

export interface MedicationLogCompatibilitySource {
  id: number;
  frequency: string | null;
}

export interface StoredMedicationLog {
  medicationId: number;
  slot: string | null;
}

export function classifyMedicationLogsForEditing<
  T extends StoredMedicationLog,
>(
  medications: ReadonlyArray<MedicationLogCompatibilitySource>,
  logs: ReadonlyArray<T>
): { editableLogs: T[]; unclassifiedLegacyCount: number } {
  const medicationById = new Map(
    medications.map((medication) => [medication.id, medication])
  );
  const editableLogs: T[] = [];
  let unclassifiedLegacyCount = 0;

  for (const log of logs) {
    const medication = medicationById.get(log.medicationId);
    if (!medication) continue;

    const isAsNeeded = medication.frequency === "as_needed";
    const slotMatchesCurrentSemantics =
      isAsNeeded ? log.slot === null : log.slot !== null;
    if (slotMatchesCurrentSemantics) {
      editableLogs.push(log);
    } else {
      unclassifiedLegacyCount += 1;
    }
  }

  return { editableLogs, unclassifiedLegacyCount };
}

function isCalendarDay(value: unknown): value is string {
  return typeof value === "string" && shiftIsoDay(value, 0) === value;
}

function isDoseSlot(value: unknown): value is DoseSlot {
  return (
    typeof value === "string" &&
    DOSE_SLOTS.some((slot) => slot.value === value)
  );
}

export function parseMedicationLogWrite(
  value: unknown
): ParsedMedicationLogWrite {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Invalid request body" };
  }

  const body = value as Record<string, unknown>;
  if (
    !Number.isInteger(body.medicationId) ||
    (body.medicationId as number) <= 0
  ) {
    return { ok: false, error: "medicationId must be a positive integer" };
  }
  if (!isCalendarDay(body.day)) {
    return { ok: false, error: "day must be a valid YYYY-MM-DD date" };
  }
  if (typeof body.taken !== "boolean") {
    return { ok: false, error: "taken must be a boolean" };
  }

  let slot: DoseSlot | null = null;
  if (body.slot !== undefined && body.slot !== null) {
    if (!isDoseSlot(body.slot)) {
      return {
        ok: false,
        error: `slot must be one of: ${DOSE_SLOTS.map((item) => item.value).join(", ")} or null`,
      };
    }
    slot = body.slot;
  }

  return {
    ok: true,
    medicationId: body.medicationId as number,
    day: body.day,
    taken: body.taken,
    slot,
  };
}

export function parseMedicationLogRange(
  start: string | null,
  end: string | null
): ParsedMedicationLogRange {
  if (start !== null && !isCalendarDay(start)) {
    return { ok: false, error: "start must be a valid YYYY-MM-DD date" };
  }
  if (end !== null && !isCalendarDay(end)) {
    return { ok: false, error: "end must be a valid YYYY-MM-DD date" };
  }
  if (start !== null && end !== null && start > end) {
    return { ok: false, error: "start must be on or before end" };
  }
  return { ok: true, start, end };
}
