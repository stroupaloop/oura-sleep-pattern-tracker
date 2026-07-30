export interface MedicationSummarySource {
  id: number;
  name: string;
  frequency: string | null;
}

export interface MedicationLogSummarySource {
  medicationId: number;
  day: string;
  slot: string | null;
  taken: number;
}

export interface RecordedMedicationSummary {
  name: string;
  taken: number;
  total: number;
  rate: number;
  asNeeded: boolean;
  unclassifiedLegacyRecords: number;
}

export function summarizeRecordedMedicationLogs(
  medications: MedicationSummarySource[],
  logs: MedicationLogSummarySource[]
): RecordedMedicationSummary[] {
  return medications.flatMap((medication) => {
    if (medication.frequency === "weekly") return [];
    const medicationLogs = logs.filter(
      (log) => log.medicationId === medication.id
    );
    const asNeeded = medication.frequency === "as_needed";
    let unclassifiedLegacyRecords = 0;
    let recordedLogs: MedicationLogSummarySource[];

    if (asNeeded) {
      const logsByDay = new Map<string, MedicationLogSummarySource[]>();
      for (const log of medicationLogs) {
        const dayLogs = logsByDay.get(log.day) ?? [];
        dayLogs.push(log);
        logsByDay.set(log.day, dayLogs);
      }
      recordedLogs = [];
      for (const dayLogs of logsByDay.values()) {
        const canonical = dayLogs.filter((log) => log.slot === null);
        const legacyUnclassified = dayLogs.filter(
          (log) => log.slot !== null
        );
        unclassifiedLegacyRecords += legacyUnclassified.length;
        recordedLogs.push(
          ...(canonical.length > 0 ? canonical : legacyUnclassified)
        );
      }
    } else {
      recordedLogs = medicationLogs.filter((log) => log.slot !== null);
      unclassifiedLegacyRecords = medicationLogs.length - recordedLogs.length;
    }

    if (recordedLogs.length === 0 && unclassifiedLegacyRecords === 0) {
      return [];
    }

    const taken = recordedLogs.filter((log) => log.taken === 1).length;
    return [
      {
        name: medication.name,
        taken,
        total: recordedLogs.length,
        rate:
          recordedLogs.length > 0 ? taken / recordedLogs.length : 0,
        asNeeded,
        unclassifiedLegacyRecords,
      },
    ];
  });
}
