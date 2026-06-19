"use client";

import {
  AS_NEEDED_KEY,
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
  onCheckedChange: (dose: DoseEntry, checked: boolean) => void;
}

function groupPillClass(key: string): string {
  switch (key) {
    case "morning":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    case "afternoon":
      return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    case "evening":
      return "bg-indigo-500/10 text-indigo-300 border-indigo-500/20";
    case "night":
      return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    case AS_NEEDED_KEY:
      return "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function MedicationDoseGroups({
  medications,
  checks,
  disabled = false,
  compact = false,
  onCheckedChange,
}: MedicationDoseGroupsProps) {
  const groups = buildMedicationDoseGroups(medications);
  const rowPadding = compact ? "py-0.5" : "py-1";

  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section key={group.key} className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 border-b border-border/60 pb-1">
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${groupPillClass(group.key)}`}
            >
              {group.label}
            </span>
          </div>
          <div className="space-y-0.5">
            {group.doses.map((dose) => {
              const checked = checks[dose.medId]?.[dose.slotKey] ?? false;
              return (
                <label
                  key={`${dose.medId}-${dose.slotKey}`}
                  className={`flex min-w-0 cursor-pointer items-center gap-2 text-sm ${rowPadding}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onCheckedChange(dose, event.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 shrink-0 rounded border-muted-foreground"
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
