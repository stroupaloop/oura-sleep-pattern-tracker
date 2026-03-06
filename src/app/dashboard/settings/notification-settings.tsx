"use client";

import { useState, useEffect } from "react";

interface NotificationRecipient {
  id: number;
  type: string;
  destination: string;
  enabled: number | null;
}

export function NotificationSettings() {
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState<"email" | "sms">("email");
  const [newDestination, setNewDestination] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchRecipients() {
    const res = await fetch("/api/settings/notifications");
    const data = await res.json();
    setRecipients(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchRecipients();
  }, []);

  async function addRecipient() {
    if (!newDestination.trim()) return;
    setSaving(true);
    await fetch("/api/settings/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: newType, destination: newDestination.trim() }),
    });
    setNewDestination("");
    await fetchRecipients();
    setSaving(false);
  }

  async function toggleEnabled(id: number, currentEnabled: number | null) {
    await fetch("/api/settings/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: currentEnabled !== 1 }),
    });
    await fetchRecipients();
  }

  async function removeRecipient(id: number) {
    await fetch(`/api/settings/notifications?id=${id}`, { method: "DELETE" });
    await fetchRecipients();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading notification settings...</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Get a reminder at 10:30 PM ET if you haven&apos;t checked in yet.
      </p>

      {recipients.length > 0 && (
        <div className="space-y-2">
          {recipients.map((r) => (
            <div key={r.id} className="flex items-center justify-between border rounded-md p-3">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={r.enabled === 1}
                    onChange={() => toggleEnabled(r.id, r.enabled)}
                    className="rounded"
                  />
                  <span className="text-sm">
                    <span className="text-xs uppercase text-muted-foreground mr-1.5">
                      {r.type}
                    </span>
                    {r.destination}
                  </span>
                </label>
              </div>
              <button
                onClick={() => removeRecipient(r.id)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-md p-3 space-y-2">
        <p className="text-sm font-medium">Add Recipient</p>
        <div className="flex items-center gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as "email" | "sms")}
            className="text-sm rounded border bg-transparent px-2 py-1.5"
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <input
            type={newType === "email" ? "email" : "tel"}
            placeholder={newType === "email" ? "email@example.com" : "+1234567890"}
            value={newDestination}
            onChange={(e) => setNewDestination(e.target.value)}
            className="flex-1 text-sm rounded border bg-transparent px-2 py-1.5"
          />
          <button
            onClick={addRecipient}
            disabled={saving || !newDestination.trim()}
            className="text-sm px-3 py-1.5 rounded bg-primary text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
