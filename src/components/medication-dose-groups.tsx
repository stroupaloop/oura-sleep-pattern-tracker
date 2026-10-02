"use client";

import { cn } from "@/lib/utils";
import {
  buildMedicationDoseGroups,
  type DoseEntry,
  type MedicationDoseSource,
} from "@/lib/medication-schedule";

type MedCheckMap = Record<number, Record<string, boolean>>;

interface MedicationDoseGroupsProps {
  medications: MedicationDoseSource[];
  checks: MedCheckMap;
  disabled?: boolean;
  compact?: boolean;
  /** "inline" puts each time of day on one line, for narrow spots. */
  layout?: "rows" | "inline";
  onCheckedChange: (dose: DoseEntry, checked: boolean) => void;
}

const CHECKBOX_CLASS = "size-4 shrink-0 accent-primary";

export function MedicationDoseGroups({
  medications,
  checks,
  disabled = false,
  compact = false,
  layout = "rows",
  onCheckedChange,
}: MedicationDoseGroupsProps) {
  const groups = buildMedicationDoseGroups(medications);

  if (groups.length === 0) return null;

  if (layout === "inline") {
    return (
      <div>
        {groups.map((group) => (
          <div key={group.key} className="flex min-w-0 items-start gap-3">
            <span className="flex min-h-10 w-16 shrink-0 items-center text-xs text-muted-foreground sm:min-h-8">
              {group.label}
            </span>
            <div className="flex min-w-0 flex-wrap gap-x-4">
              {group.doses.map((dose) => (
                <label
                  key={`${dose.medId}-${dose.slotKey}`}
                  title={dose.dosage ?? undefined}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm sm:min-h-8"
                >
                  <input
                    type="checkbox"
                    checked={checks[dose.medId]?.[dose.slotKey] ?? false}
                    onChange={(event) =>
                      onCheckedChange(dose, event.target.checked)
                    }
                    disabled={disabled}
                    className={CHECKBOX_CLASS}
                  />
                  {dose.medName}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.key} className="min-w-0">
          <h3 className="border-b pb-1 text-xs font-medium text-muted-foreground">
            {group.label}
          </h3>
          <div>
            {group.doses.map((dose) => {
              const checked = checks[dose.medId]?.[dose.slotKey] ?? false;
              return (
                <label
                  key={`${dose.medId}-${dose.slotKey}`}
                  className={cn(
                    "flex min-h-10 min-w-0 cursor-pointer items-center gap-3 text-sm",
                    compact ? "sm:min-h-8" : "sm:min-h-9"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onCheckedChange(dose, event.target.checked)}
                    disabled={disabled}
                    className={CHECKBOX_CLASS}
                  />
                  <span className="min-w-0 truncate">
                    <span>{dose.medName}</span>
                    {dose.dosage && (
                      <span
                        className="ml-2 text-xs text-muted-foreground"
                        title={dose.dosage}
                      >
                        {dose.dosage}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
