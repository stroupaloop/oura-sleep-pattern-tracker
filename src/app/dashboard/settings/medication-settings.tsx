"use client";

import { useState, useEffect } from "react";
import { getTodayET } from "@/lib/date-utils";
import { getSupersededMedicationIds } from "@/lib/medication-write";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ToggleChip } from "@/components/ui/toggle-chip";

const SLOTS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
] as const;
type Slot = (typeof SLOTS)[number]["value"];

interface Medication {
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

function parseSchedule(raw: string | null | undefined): Slot[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((s): s is Slot =>
      SLOTS.some((slot) => slot.value === s)
    );
  } catch {
    return [];
  }
}

function defaultScheduleForFrequency(frequency: string | null): Slot[] {
  if (frequency === "as_needed" || frequency === "weekly") return [];
  if (frequency === "twice_daily") return ["morning", "evening"];
  return ["morning"];
}

function formatScheduleLabel(slots: Slot[]): string {
  if (slots.length === 0) return "";
  return slots.map((s) => SLOTS.find((x) => x.value === s)?.label ?? s).join(" + ");
}

function DoseSchedule({
  id,
  value,
  onToggle,
}: {
  id: string;
  value: Slot[];
  onToggle: (slot: Slot) => void;
}) {
  return (
    <div className="space-y-2">
      <p id={id} className="text-sm leading-none font-medium">
        Dose schedule
      </p>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {SLOTS.map((slot) => (
          <ToggleChip
            key={slot.value}
            pressed={value.includes(slot.value)}
            onClick={() => onToggle(slot.value)}
          >
            {slot.label}
          </ToggleChip>
        ))}
      </div>
    </div>
  );
}

async function getApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function MedicationSettings() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newFrequency, setNewFrequency] = useState("daily");
  const [newSchedule, setNewSchedule] = useState<Slot[]>(["morning"]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Partial<Medication>>({});
  const [editSchedule, setEditSchedule] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchMeds() {
    const res = await fetch("/api/medications?all=1");
    if (!res.ok) {
      throw new Error(await getApiError(res, "Failed to refresh medications"));
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Failed to refresh medications");
    setMeds(data);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/medications?all=1")
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load medications");
        return response.json() as Promise<Medication[]>;
      })
      .then((data) => {
        if (!active) return;
        setMeds(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setMeds([]);
        setError("Failed to load medications.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function addMed() {
    if (!newName.trim()) return;
    setSaving(true);
    setError(null);
    const today = getTodayET();
    try {
      const response = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          dosage: newDosage.trim() || null,
          frequency: newFrequency,
          doseSchedule: newFrequency === "as_needed" ? null : newSchedule,
          startDate: today,
        }),
      });
      if (!response.ok) {
        throw new Error(await getApiError(response, "Medication was not added"));
      }
      setNewName("");
      setNewDosage("");
      setNewFrequency("daily");
      setNewSchedule(["morning"]);
      try {
        await fetchMeds();
      } catch {
        setError("Medication was added, but the list could not be refreshed.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Medication was not added");
    } finally {
      setSaving(false);
    }
  }

  async function updateMed(id: number, updates: Record<string, unknown>) {
    const response = await fetch("/api/medications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!response.ok) {
      throw new Error(await getApiError(response, "Medication was not updated"));
    }
    try {
      await fetchMeds();
    } catch {
      setError("Medication was updated, but the list could not be refreshed.");
    }
  }

  async function deactivate(id: number) {
    const today = getTodayET();
    setError(null);
    try {
      await updateMed(id, { isActive: false, endDate: today });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Medication was not updated");
    }
  }

  async function reactivate(id: number) {
    setError(null);
    try {
      await updateMed(id, { isActive: true, endDate: null });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Medication was not updated");
    }
  }

  function startEdit(med: Medication) {
    setEditingId(med.id);
    setEditFields({
      dosage: med.dosage,
      frequency: med.frequency,
      startDate: med.startDate,
    });
    setEditSchedule(parseSchedule(med.doseSchedule));
  }

  function handleEditFrequencyChange(freq: string) {
    setEditFields((prev) => ({ ...prev, frequency: freq }));
    if (freq === "as_needed") {
      setEditSchedule([]);
    } else if (editSchedule.length === 0) {
      setEditSchedule(defaultScheduleForFrequency(freq));
    }
  }

  function handleNewFrequencyChange(freq: string) {
    setNewFrequency(freq);
    setNewSchedule(defaultScheduleForFrequency(freq));
  }

  function toggleSlot(current: Slot[], slot: Slot): Slot[] {
    return current.includes(slot)
      ? current.filter((s) => s !== slot)
      : [...current, slot];
  }

  async function saveEdit(id: number) {
    setSaving(true);
    setError(null);
    const updates: Record<string, unknown> = { ...editFields };
    if (editFields.frequency === "as_needed") {
      updates.doseSchedule = null;
    } else {
      updates.doseSchedule = editSchedule;
    }
    try {
      await updateMed(id, updates);
      setEditingId(null);
      setEditFields({});
      setEditSchedule([]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Medication was not updated");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading medications...</p>;
  }

  const active = meds.filter((m) => m.isActive === 1);
  const inactive = meds.filter((m) => m.isActive !== 1);
  const supersededIds = getSupersededMedicationIds(meds);

  return (
    <div className="space-y-6">
      {error && <FormMessage kind="error">{error}</FormMessage>}
      {active.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium">Active</h3>
          <ul className="divide-y">
            {active.map((med) => {
              const schedule = parseSchedule(med.doseSchedule);
              return (
                <li key={med.id} className="py-3">
                  {editingId === med.id ? (
                    <div className="space-y-4">
                      <p className="font-medium text-sm">{med.name}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`med-${med.id}-dosage`}>Dosage</Label>
                          <Input
                            id={`med-${med.id}-dosage`}
                            placeholder="e.g. 150mg"
                            value={editFields.dosage ?? ""}
                            onChange={(e) => setEditFields((prev) => ({ ...prev, dosage: e.target.value }))}
                            className="h-10 sm:h-9"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`med-${med.id}-frequency`}>Frequency</Label>
                          <NativeSelect
                            id={`med-${med.id}-frequency`}
                            value={editFields.frequency ?? "daily"}
                            onChange={(e) => handleEditFrequencyChange(e.target.value)}
                          >
                            <option value="daily">Daily</option>
                            <option value="twice_daily">Twice daily</option>
                            <option value="as_needed">As needed</option>
                            {editFields.frequency === "weekly" && (
                              <option value="weekly" disabled>
                                Weekly (unsupported)
                              </option>
                            )}
                          </NativeSelect>
                        </div>
                      </div>
                      {editFields.frequency !== "as_needed" && (
                        <DoseSchedule
                          id={`med-${med.id}-schedule`}
                          value={editSchedule}
                          onToggle={(slot) => setEditSchedule((prev) => toggleSlot(prev, slot))}
                        />
                      )}
                      <div className="space-y-2">
                        <Label htmlFor={`med-${med.id}-start`}>Start date</Label>
                        <Input
                          id={`med-${med.id}-start`}
                          type="date"
                          value={editFields.startDate ?? ""}
                          onChange={(e) => setEditFields((prev) => ({ ...prev, startDate: e.target.value || null }))}
                          className="h-10 sm:h-9 sm:w-48"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => saveEdit(med.id)}
                          disabled={
                            saving ||
                            editFields.frequency === "weekly" ||
                            (editFields.frequency !== "as_needed" &&
                              editSchedule.length === 0)
                          }
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{med.name}</span>
                        {med.dosage && (
                          <span className="text-xs text-muted-foreground ml-2">{med.dosage}</span>
                        )}
                        {med.frequency === "weekly" ? (
                          <span className="text-xs text-muted-foreground ml-2">
                            (weekly tracking unavailable; not shown in daily check-ins)
                          </span>
                        ) : med.frequency === "as_needed" ? (
                          <span className="text-xs text-muted-foreground ml-2">(as needed)</span>
                        ) : schedule.length > 0 ? (
                          <span className="text-xs text-muted-foreground ml-2">
                            · {formatScheduleLabel(schedule)}
                          </span>
                        ) : med.frequency ? (
                          <span className="text-xs text-muted-foreground ml-2">({med.frequency})</span>
                        ) : null}
                        {med.startDate && (
                          <span className="text-xs text-muted-foreground tabular-nums ml-2">since {med.startDate}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(med)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deactivate(med.id)}
                        >
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground">Inactive</h3>
          <ul className="divide-y">
            {inactive.map((med) => (
              <li
                key={med.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3"
              >
                <div className="min-w-0 text-muted-foreground">
                  <span className="text-sm">{med.name}</span>
                  {med.dosage && (
                    <span className="text-xs ml-2">{med.dosage}</span>
                  )}
                  {med.endDate && (
                    <span className="text-xs tabular-nums ml-2">ended {med.endDate}</span>
                  )}
                </div>
                {!supersededIds.has(med.id) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reactivate(med.id)}
                  >
                    Reactivate
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cn("space-y-4", meds.length > 0 && "border-t pt-4")}>
        <h3 className="text-sm font-medium">Add Medication</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="new-med-name">Name</Label>
            <Input
              id="new-med-name"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-10 sm:h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-med-dosage">Dosage</Label>
            <Input
              id="new-med-dosage"
              placeholder="e.g. 150mg"
              value={newDosage}
              onChange={(e) => setNewDosage(e.target.value)}
              className="h-10 sm:h-9"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-med-frequency">Frequency</Label>
          <div className="sm:w-48">
            <NativeSelect
              id="new-med-frequency"
              value={newFrequency}
              onChange={(e) => handleNewFrequencyChange(e.target.value)}
            >
              <option value="daily">Daily</option>
              <option value="twice_daily">Twice daily</option>
              <option value="as_needed">As needed</option>
            </NativeSelect>
          </div>
        </div>
        {newFrequency !== "as_needed" && (
          <DoseSchedule
            id="new-med-schedule"
            value={newSchedule}
            onToggle={(slot) => setNewSchedule((prev) => toggleSlot(prev, slot))}
          />
        )}
        <Button
          onClick={addMed}
          disabled={
            saving ||
            !newName.trim() ||
            (newFrequency !== "as_needed" && newSchedule.length === 0)
          }
        >
          Add
        </Button>
      </div>
    </div>
  );
}
