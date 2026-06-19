export const DOSE_SLOTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
] as const;

export type DoseSlot = (typeof DOSE_SLOTS)[number]["value"];

export const AS_NEEDED_KEY = "as_needed";

export interface MedicationDoseSource {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  doseSchedule: string | null;
}

export interface DoseEntry {
  medId: number;
  medName: string;
  dosage: string | null;
  slotKey: string;
}

export interface DoseGroup {
  key: string;
  label: string;
  doses: DoseEntry[];
}

const SLOT_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
  [AS_NEEDED_KEY]: 4,
};

export function parseMedicationSchedule(raw: string | null | undefined): DoseSlot[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is DoseSlot =>
      DOSE_SLOTS.some((slot) => slot.value === s)
    );
  } catch {
    return [];
  }
}

export function defaultScheduleForFrequency(
  frequency: string | null | undefined
): DoseSlot[] {
  if (frequency === "as_needed") return [];
  return frequency === "twice_daily" ? ["morning", "evening"] : ["morning"];
}

export function slotsForMedication(
  med: Pick<MedicationDoseSource, "frequency" | "doseSchedule">
): DoseSlot[] {
  if (med.frequency === "as_needed") return [];
  const parsed = parseMedicationSchedule(med.doseSchedule);
  return parsed.length > 0 ? parsed : defaultScheduleForFrequency(med.frequency);
}

export function doseSlotLabel(slot: DoseSlot): string {
  return DOSE_SLOTS.find((s) => s.value === slot)?.label ?? slot;
}

export function formatMedicationScheduleLabel(slots: DoseSlot[]): string {
  if (slots.length === 0) return "";
  return slots.map((s) => doseSlotLabel(s)).join(" + ");
}

function groupLabelForKey(key: string): string {
  if (key === AS_NEEDED_KEY) return "PRN";
  const slot = DOSE_SLOTS.find((s) => s.value === key);
  return slot?.label ?? key;
}

function buildDoseEntries(meds: MedicationDoseSource[]): DoseEntry[] {
  const doses = meds.flatMap((med) => {
    const slots = slotsForMedication(med);
    if (slots.length === 0) {
      return [
        {
          medId: med.id,
          medName: med.name,
          dosage: med.dosage,
          slotKey: AS_NEEDED_KEY,
        },
      ];
    }
    return slots.map((slot) => ({
      medId: med.id,
      medName: med.name,
      dosage: med.dosage,
      slotKey: slot,
    }));
  });

  return doses.sort((a, b) => {
    const slotDiff = (SLOT_ORDER[a.slotKey] ?? 99) - (SLOT_ORDER[b.slotKey] ?? 99);
    if (slotDiff !== 0) return slotDiff;
    return a.medName.localeCompare(b.medName);
  });
}

export function buildMedicationDoseGroups(meds: MedicationDoseSource[]): DoseGroup[] {
  const groups = new Map<string, DoseGroup>();

  for (const dose of buildDoseEntries(meds)) {
    const group =
      groups.get(dose.slotKey) ??
      {
        key: dose.slotKey,
        label: groupLabelForKey(dose.slotKey),
        doses: [],
      };
    group.doses.push(dose);
    groups.set(dose.slotKey, group);
  }

  return Array.from(groups.values()).sort(
    (a, b) => (SLOT_ORDER[a.key] ?? 99) - (SLOT_ORDER[b.key] ?? 99)
  );
}
