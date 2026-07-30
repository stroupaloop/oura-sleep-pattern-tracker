import { DOSE_SLOTS, type DoseSlot } from "./medication-schedule";
import { shiftIsoDay } from "./date-utils";

export const MEDICATION_FREQUENCIES = [
  "daily",
  "twice_daily",
  "as_needed",
] as const;

export type MedicationFrequency = (typeof MEDICATION_FREQUENCIES)[number];

export interface MedicationRecord {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  doseSchedule: string | null;
  isActive: number | null;
  startDate: string | null;
  endDate: string | null;
  previousVersionId: number | null;
}

export interface MedicationCreateValues {
  name: string;
  dosage: string | null;
  frequency: MedicationFrequency;
  doseSchedule: string | null;
  isActive: 1;
  startDate: string;
  endDate: null;
  previousVersionId: null;
}

export interface MedicationUpdateInput {
  id: number;
  name?: string;
  dosage?: string | null;
  frequency?: MedicationFrequency;
  doseSchedule?: DoseSlot[] | null;
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

interface MedicationDirectUpdates {
  name?: string;
  dosage?: string | null;
  frequency?: string | null;
  doseSchedule?: string | null;
  isActive?: 0 | 1;
  startDate?: string | null;
  endDate?: string | null;
}

type MedicationVersionValues = Omit<
  MedicationCreateValues,
  "frequency" | "previousVersionId"
> & { frequency: string | null; previousVersionId: number };

export type MedicationUpdatePlan =
  | { ok: true; kind: "noop" }
  | { ok: true; kind: "update"; updates: MedicationDirectUpdates }
  | {
      ok: true;
      kind: "cancel-future-version";
      predecessorId: number;
    }
  | {
      ok: true;
      kind: "version";
      closeUpdates: { isActive: 0; endDate: string } | null;
      createValues: MedicationVersionValues;
    }
  | { ok: false; error: string; status: 400 | 409 };

function hasOwn(value: object, key: string): boolean {
  return Object.hasOwn(value, key);
}

function isCalendarDay(value: unknown): value is string {
  return typeof value === "string" && shiftIsoDay(value, 0) === value;
}

function isFrequency(value: unknown): value is MedicationFrequency {
  return (
    typeof value === "string" &&
    MEDICATION_FREQUENCIES.includes(value as MedicationFrequency)
  );
}

function parseSchedule(value: unknown): ParseResult<DoseSlot[] | null> {
  if (value === null) return { ok: true, value: null };
  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: "doseSchedule must be an array of dose slots or null",
    };
  }

  const slots: DoseSlot[] = [];
  for (const entry of value) {
    const slot = DOSE_SLOTS.find((candidate) => candidate.value === entry);
    if (!slot) {
      return {
        ok: false,
        error: `doseSchedule entries must be one of: ${DOSE_SLOTS.map((candidate) => candidate.value).join(", ")}`,
      };
    }
    if (!slots.includes(slot.value)) slots.push(slot.value);
  }
  slots.sort(
    (left, right) =>
      DOSE_SLOTS.findIndex((slot) => slot.value === left) -
      DOSE_SLOTS.findIndex((slot) => slot.value === right)
  );
  return { ok: true, value: slots };
}

function serializeSchedule(
  frequency: MedicationFrequency,
  schedule: DoseSlot[] | null | undefined
): ParseResult<string | null> {
  if (frequency === "as_needed") {
    if (schedule !== undefined && schedule !== null) {
      return {
        ok: false,
        error: "doseSchedule must be null for an as-needed medication",
      };
    }
    return { ok: true, value: null };
  }

  if (schedule === null || (schedule !== undefined && schedule.length === 0)) {
    return {
      ok: false,
      error: "A scheduled medication must have at least one dose slot",
    };
  }
  if (schedule !== undefined) {
    return { ok: true, value: JSON.stringify(schedule) };
  }
  return {
    ok: true,
    value:
      frequency === "twice_daily"
        ? JSON.stringify(["morning", "evening"])
        : JSON.stringify(["morning"]),
  };
}

function parseOptionalText(
  body: Record<string, unknown>,
  key: "name" | "dosage"
): ParseResult<string | null | undefined> {
  if (!hasOwn(body, key)) return { ok: true, value: undefined };
  const value = body[key];
  if (key === "dosage" && value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return {
      ok: false,
      error: `${key} must be ${key === "dosage" ? "a string or null" : "a non-empty string"}`,
    };
  }
  const normalized = value.trim();
  if (key === "name" && normalized.length === 0) {
    return { ok: false, error: "name must be a non-empty string" };
  }
  return {
    ok: true,
    value: key === "dosage" && normalized.length === 0 ? null : normalized,
  };
}

function parseOptionalDay(
  body: Record<string, unknown>,
  key: "startDate" | "endDate"
): ParseResult<string | null | undefined> {
  if (!hasOwn(body, key)) return { ok: true, value: undefined };
  const value = body[key];
  if (value === null) return { ok: true, value: null };
  if (!isCalendarDay(value)) {
    return {
      ok: false,
      error: `${key} must be a real calendar day in YYYY-MM-DD format or null`,
    };
  }
  return { ok: true, value };
}

export function parseMedicationCreate(
  value: unknown,
  today: string
): ParseResult<MedicationCreateValues> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Invalid request body" };
  }
  if (!isCalendarDay(today)) {
    return { ok: false, error: "Invalid effective date" };
  }
  const body = value as Record<string, unknown>;
  const parsedName = parseOptionalText(body, "name");
  if (!parsedName.ok) return parsedName;
  if (parsedName.value == null) {
    return { ok: false, error: "name must be a non-empty string" };
  }
  const parsedDosage = parseOptionalText(body, "dosage");
  if (!parsedDosage.ok) return parsedDosage;

  const frequency = hasOwn(body, "frequency") ? body.frequency : "daily";
  if (!isFrequency(frequency)) {
    return {
      ok: false,
      error: "frequency must be daily, twice_daily, or as_needed",
    };
  }

  let schedule: DoseSlot[] | null | undefined;
  if (hasOwn(body, "doseSchedule")) {
    const parsedSchedule = parseSchedule(body.doseSchedule);
    if (!parsedSchedule.ok) return parsedSchedule;
    schedule = parsedSchedule.value;
  }
  const serializedSchedule = serializeSchedule(frequency, schedule);
  if (!serializedSchedule.ok) return serializedSchedule;

  const parsedStartDate = parseOptionalDay(body, "startDate");
  if (!parsedStartDate.ok) return parsedStartDate;

  return {
    ok: true,
    value: {
      name: parsedName.value,
      dosage: parsedDosage.value ?? null,
      frequency,
      doseSchedule: serializedSchedule.value,
      isActive: 1,
      startDate: parsedStartDate.value ?? today,
      endDate: null,
      previousVersionId: null,
    },
  };
}

export function parseMedicationUpdate(
  value: unknown
): ParseResult<MedicationUpdateInput> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Invalid request body" };
  }
  const body = value as Record<string, unknown>;
  if (!Number.isSafeInteger(body.id) || (body.id as number) <= 0) {
    return { ok: false, error: "id must be a positive integer" };
  }

  const update: MedicationUpdateInput = { id: body.id as number };
  const parsedName = parseOptionalText(body, "name");
  if (!parsedName.ok) return parsedName;
  if (parsedName.value !== undefined) update.name = parsedName.value as string;

  const parsedDosage = parseOptionalText(body, "dosage");
  if (!parsedDosage.ok) return parsedDosage;
  if (parsedDosage.value !== undefined) update.dosage = parsedDosage.value;

  if (hasOwn(body, "frequency")) {
    if (!isFrequency(body.frequency)) {
      return {
        ok: false,
        error: "frequency must be daily, twice_daily, or as_needed",
      };
    }
    update.frequency = body.frequency;
  }
  if (hasOwn(body, "doseSchedule")) {
    const parsedSchedule = parseSchedule(body.doseSchedule);
    if (!parsedSchedule.ok) return parsedSchedule;
    update.doseSchedule = parsedSchedule.value;
  }
  if (hasOwn(body, "isActive")) {
    if (typeof body.isActive !== "boolean") {
      return { ok: false, error: "isActive must be a boolean" };
    }
    update.isActive = body.isActive;
  }

  for (const key of ["startDate", "endDate"] as const) {
    const parsedDay = parseOptionalDay(body, key);
    if (!parsedDay.ok) return parsedDay;
    if (parsedDay.value !== undefined) update[key] = parsedDay.value;
  }

  if (Object.keys(update).length === 1) {
    return { ok: false, error: "No medication fields were provided" };
  }
  return { ok: true, value: update };
}

function canonicalSchedule(value: string | null): string | null {
  if (value === null) return null;
  try {
    const parsed = parseSchedule(JSON.parse(value));
    return parsed.ok && parsed.value !== null
      ? JSON.stringify(parsed.value)
      : value;
  } catch {
    return value;
  }
}

function resolveRegimen(
  existing: MedicationRecord,
  update: MedicationUpdateInput
): ParseResult<
  Pick<
    MedicationVersionValues,
    "name" | "dosage" | "frequency" | "doseSchedule"
  >
> {
  const frequency = update.frequency ?? existing.frequency;
  let doseSchedule = existing.doseSchedule;

  if (
    update.doseSchedule !== undefined ||
    (update.frequency !== undefined &&
      update.frequency !== existing.frequency)
  ) {
    if (!isFrequency(frequency)) {
      return {
        ok: false,
        error: "Choose a supported frequency before changing the schedule",
      };
    }
    const serializedSchedule = serializeSchedule(
      frequency,
      update.doseSchedule
    );
    if (!serializedSchedule.ok) return serializedSchedule;
    doseSchedule = serializedSchedule.value;
  }

  return {
    ok: true,
    value: {
      name: update.name ?? existing.name,
      dosage:
        update.dosage !== undefined ? update.dosage : existing.dosage,
      frequency,
      doseSchedule,
    },
  };
}

export function planMedicationUpdate(
  existing: MedicationRecord,
  update: MedicationUpdateInput,
  today: string,
  hasSuccessor = false
): MedicationUpdatePlan {
  const tomorrow = shiftIsoDay(today, 1);
  if (!tomorrow) {
    return { ok: false, error: "Invalid effective date", status: 400 };
  }

  const regimen = resolveRegimen(existing, update);
  if (!regimen.ok) return { ...regimen, status: 400 };
  const contentChanged =
    regimen.value.name !== existing.name ||
    regimen.value.dosage !== existing.dosage ||
    regimen.value.frequency !== existing.frequency ||
    canonicalSchedule(regimen.value.doseSchedule) !==
      canonicalSchedule(existing.doseSchedule);
  const startChanged =
    update.startDate !== undefined && update.startDate !== existing.startDate;
  const endChanged =
    update.endDate !== undefined && update.endDate !== existing.endDate;
  const active = existing.isActive === 1;

  if (active && update.isActive === false) {
    if (contentChanged || startChanged) {
      return {
        ok: false,
        error: "Edit the regimen separately before deactivating it",
        status: 409,
      };
    }
    if (update.endDate !== undefined && update.endDate !== today) {
      return {
        ok: false,
        error: "A deactivation must end on today's date",
        status: 400,
      };
    }
    if (
      existing.startDate !== null &&
      existing.startDate > today &&
      existing.previousVersionId !== null
    ) {
      if (hasSuccessor) {
        return {
          ok: false,
          error: "A superseded medication version cannot be cancelled",
          status: 409,
        };
      }
      return {
        ok: true,
        kind: "cancel-future-version",
        predecessorId: existing.previousVersionId,
      };
    }
    const updates: MedicationDirectUpdates = {
      isActive: 0,
      endDate: today,
    };
    if (existing.startDate !== null && existing.startDate > today) {
      updates.startDate = today;
    }
    return { ok: true, kind: "update", updates };
  }

  if (!active && update.isActive === true) {
    if (hasSuccessor) {
      return {
        ok: false,
        error: "This historical medication version has already been superseded",
        status: 409,
      };
    }
    if (update.endDate !== undefined && update.endDate !== null) {
      return {
        ok: false,
        error: "A reactivated medication cannot have an end date",
        status: 400,
      };
    }
    const dayAfterPriorEnd =
      existing.endDate === null ? null : shiftIsoDay(existing.endDate, 1);
    if (existing.endDate !== null && dayAfterPriorEnd === null) {
      return {
        ok: false,
        error: "The prior medication period has an invalid end date",
        status: 409,
      };
    }
    const earliestStartDate =
      dayAfterPriorEnd !== null && dayAfterPriorEnd > today
        ? dayAfterPriorEnd
        : today;
    const newStartDate = update.startDate ?? earliestStartDate;
    if (newStartDate < earliestStartDate) {
      return {
        ok: false,
        error: `A reactivated period must start on or after ${earliestStartDate}`,
        status: 400,
      };
    }
    return {
      ok: true,
      kind: "version",
      closeUpdates: null,
      createValues: {
        ...regimen.value,
        isActive: 1,
        startDate: newStartDate,
        endDate: null,
        previousVersionId: existing.id,
      },
    };
  }

  if (contentChanged) {
    if (!active) {
      return {
        ok: false,
        error: "Reactivate this medication before editing its regimen",
        status: 409,
      };
    }
    if (startChanged || (update.endDate !== undefined && update.endDate !== null)) {
      return {
        ok: false,
        error: "Edit effective dates separately from regimen details",
        status: 409,
      };
    }
    if (hasSuccessor) {
      return {
        ok: false,
        error: "This medication version has already been superseded",
        status: 409,
      };
    }
    if (existing.startDate !== null && existing.startDate > today) {
      return {
        ok: true,
        kind: "update",
        updates: regimen.value,
      };
    }
    return {
      ok: true,
      kind: "version",
      closeUpdates: { isActive: 0, endDate: today },
      createValues: {
        ...regimen.value,
        isActive: 1,
        startDate: tomorrow,
        endDate: null,
        previousVersionId: existing.id,
      },
    };
  }

  const updates: MedicationDirectUpdates = {};
  if (startChanged) updates.startDate = update.startDate;
  if (endChanged) updates.endDate = update.endDate;

  const resultingStartDate =
    update.startDate !== undefined ? update.startDate : existing.startDate;
  const resultingEndDate =
    update.endDate !== undefined ? update.endDate : existing.endDate;
  if (active && resultingEndDate !== null) {
    return {
      ok: false,
      error: "An active medication cannot have an end date",
      status: 400,
    };
  }
  if (
    resultingStartDate !== null &&
    resultingEndDate !== null &&
    resultingStartDate > resultingEndDate
  ) {
    return {
      ok: false,
      error: "startDate must be on or before endDate",
      status: 400,
    };
  }

  return Object.keys(updates).length === 0
    ? { ok: true, kind: "noop" }
    : { ok: true, kind: "update", updates };
}

export function getSupersededMedicationIds(
  medications: readonly Pick<MedicationRecord, "previousVersionId">[]
): Set<number> {
  return new Set(
    medications.flatMap((medication) =>
      medication.previousVersionId === null
        ? []
        : [medication.previousVersionId]
    )
  );
}
