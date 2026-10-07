import {
  AS_NEEDED_KEY,
  doseSlotLabel,
  slotsForMedication,
} from "@/lib/medication-schedule";

export interface DoseMedication {
  id: number;
  name: string;
  frequency: string | null;
  doseSchedule: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DoseLog {
  medicationId: number;
  slot: string | null;
  taken: number;
}

export interface DoseSummary {
  taken: string[];
  notTaken: string[];
}

/**
 * The day's scheduled doses, split by whether they were marked taken. An
 * as-needed dose is listed only once taken; weekly and inactive medications
 * are left out, as they are on the check-in. When `dueSlots` is given, doses
 * in other slots are left out too.
 */
export function summarizeDoses(
  medications: readonly DoseMedication[],
  logs: readonly DoseLog[],
  day: string,
  dueSlots?: ReadonlySet<string>
): DoseSummary {
  const takenKeys = new Set(
    logs
      .filter((log) => log.taken === 1)
      .map((log) => `${log.medicationId}:${log.slot ?? AS_NEEDED_KEY}`)
  );
  const summary: DoseSummary = { taken: [], notTaken: [] };

  for (const med of medications) {
    if (med.startDate && med.startDate > day) continue;
    if (med.endDate && med.endDate < day) continue;
    if (med.frequency === "weekly") continue;

    const slots = slotsForMedication(med);
    if (slots.length === 0) {
      if (takenKeys.has(`${med.id}:${AS_NEEDED_KEY}`)) {
        summary.taken.push(med.name);
      }
      continue;
    }
    for (const slot of slots) {
      if (dueSlots && !dueSlots.has(slot)) continue;
      const label = `${med.name} (${doseSlotLabel(slot)})`;
      if (takenKeys.has(`${med.id}:${slot}`)) summary.taken.push(label);
      else summary.notTaken.push(label);
    }
  }
  return summary;
}
