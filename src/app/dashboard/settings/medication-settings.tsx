"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";

interface Medication {
  id: number;
  name: string;
  dosage: string | null;
  frequency: string | null;
  isActive: number | null;
  startDate: string | null;
  endDate: string | null;
}

export function MedicationSettings() {
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newFrequency, setNewFrequency] = useState("daily");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFields, setEditFields] = useState<Partial<Medication>>({});
  const [saving, setSaving] = useState(false);

  async function fetchMeds() {
    const res = await fetch("/api/medications?all=1");
    const data = await res.json();
    setMeds(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchMeds();
  }, []);

  async function addMed() {
    if (!newName.trim()) return;
    setSaving(true);
    const today = format(new Date(), "yyyy-MM-dd");
    await fetch("/api/medications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        dosage: newDosage.trim() || null,
        frequency: newFrequency,
        startDate: today,
      }),
    });
    setNewName("");
    setNewDosage("");
    setNewFrequency("daily");
    await fetchMeds();
    setSaving(false);
  }

  async function updateMed(id: number, updates: Record<string, unknown>) {
    await fetch("/api/medications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    await fetchMeds();
  }

  async function deactivate(id: number) {
    const today = format(new Date(), "yyyy-MM-dd");
    await updateMed(id, { isActive: 0, endDate: today });
  }

  async function reactivate(id: number) {
    await updateMed(id, { isActive: 1, endDate: null });
  }

  function startEdit(med: Medication) {
    setEditingId(med.id);
    setEditFields({
      dosage: med.dosage,
      frequency: med.frequency,
      startDate: med.startDate,
    });
  }

  async function saveEdit(id: number) {
    setSaving(true);
    await updateMed(id, editFields);
    setEditingId(null);
    setEditFields({});
    setSaving(false);
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading medications...</p>;
  }

  const active = meds.filter((m) => m.isActive === 1);
  const inactive = meds.filter((m) => m.isActive !== 1);

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Active</p>
          {active.map((med) => (
            <div key={med.id} className="flex flex-col gap-2 border rounded-md p-3">
              {editingId === med.id ? (
                <div className="space-y-2">
                  <p className="font-medium text-sm">{med.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Dosage"
                      value={editFields.dosage ?? ""}
                      onChange={(e) => setEditFields((prev) => ({ ...prev, dosage: e.target.value }))}
                      className="text-sm rounded border bg-transparent px-2 py-1"
                    />
                    <select
                      value={editFields.frequency ?? "daily"}
                      onChange={(e) => setEditFields((prev) => ({ ...prev, frequency: e.target.value }))}
                      className="text-sm rounded border bg-transparent px-2 py-1"
                    >
                      <option value="daily">Daily</option>
                      <option value="twice_daily">Twice daily</option>
                      <option value="as_needed">As needed</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Start date:</label>
                    <input
                      type="date"
                      value={editFields.startDate ?? ""}
                      onChange={(e) => setEditFields((prev) => ({ ...prev, startDate: e.target.value || null }))}
                      className="text-sm rounded border bg-transparent px-2 py-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(med.id)}
                      disabled={saving}
                      className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-xs px-3 py-1 rounded bg-muted text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{med.name}</span>
                    {med.dosage && (
                      <span className="text-xs text-muted-foreground ml-2">{med.dosage}</span>
                    )}
                    {med.frequency && (
                      <span className="text-xs text-muted-foreground ml-2">({med.frequency})</span>
                    )}
                    {med.startDate && (
                      <span className="text-xs text-muted-foreground ml-2">since {med.startDate}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(med)}
                      className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deactivate(med.id)}
                      className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    >
                      Deactivate
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Inactive</p>
          {inactive.map((med) => (
            <div key={med.id} className="flex items-center justify-between border rounded-md p-3 opacity-60">
              <div>
                <span className="text-sm">{med.name}</span>
                {med.dosage && (
                  <span className="text-xs text-muted-foreground ml-2">{med.dosage}</span>
                )}
                {med.endDate && (
                  <span className="text-xs text-muted-foreground ml-2">ended {med.endDate}</span>
                )}
              </div>
              <button
                onClick={() => reactivate(med.id)}
                className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20"
              >
                Reactivate
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-md p-3 space-y-2">
        <p className="text-sm font-medium">Add Medication</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="text-sm rounded border bg-transparent px-2 py-1.5"
          />
          <input
            type="text"
            placeholder="Dosage (e.g. 150mg)"
            value={newDosage}
            onChange={(e) => setNewDosage(e.target.value)}
            className="text-sm rounded border bg-transparent px-2 py-1.5"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={newFrequency}
            onChange={(e) => setNewFrequency(e.target.value)}
            className="text-sm rounded border bg-transparent px-2 py-1.5"
          >
            <option value="daily">Daily</option>
            <option value="twice_daily">Twice daily</option>
            <option value="as_needed">As needed</option>
            <option value="weekly">Weekly</option>
          </select>
          <button
            onClick={addMed}
            disabled={saving || !newName.trim()}
            className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
