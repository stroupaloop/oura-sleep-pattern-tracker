"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

const TYPE_LABELS: Record<string, string> = { email: "Email", sms: "SMS" };

interface NotificationRecipient {
  id: number;
  type: string;
  destination: string;
  enabled: number | null;
  reminderHour: number | null;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const period = i >= 12 ? "PM" : "AM";
  const display = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { value: i, label: `${display}:00 ${period}` };
});

export function NotificationSettings() {
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState<"email" | "sms">("email");
  const [newDestination, setNewDestination] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reminderHour, setReminderHour] = useState(22);

  async function fetchRecipients() {
    const res = await fetch("/api/settings/notifications");
    const data = await res.json();
    setRecipients(data);
    if (data.length > 0) {
      setReminderHour(data[0].reminderHour ?? 22);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/settings/notifications")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load notification settings");
        }
        return response.json() as Promise<NotificationRecipient[]>;
      })
      .then((data) => {
        if (!active) return;
        const nextRecipients = Array.isArray(data) ? data : [];
        setRecipients(nextRecipients);
        if (nextRecipients.length > 0) {
          setReminderHour(nextRecipients[0].reminderHour ?? 22);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setRecipients([]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function addRecipient() {
    if (!newDestination.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType, destination: newDestination.trim(), reminderHour }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to save" }));
        setError(data.error || `Failed to save (${res.status})`);
        setSaving(false);
        return;
      }
      setNewDestination("");
      await fetchRecipients();
    } catch {
      setError("Network error — could not save");
    }
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

  async function updateReminderHour(hour: number) {
    setReminderHour(hour);
    for (const r of recipients) {
      await fetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, reminderHour: hour }),
      });
    }
    await fetchRecipients();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading notification settings...</p>;
  }

  const selectedLabel = HOUR_OPTIONS.find((o) => o.value === reminderHour)?.label ?? "10:00 PM";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="reminder-hour">Reminder time</Label>
        <div className="sm:w-48">
          <NativeSelect
            id="reminder-hour"
            aria-describedby="reminder-hour-note"
            value={reminderHour}
            onChange={(e) => updateReminderHour(Number(e.target.value))}
          >
            {HOUR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ET
              </option>
            ))}
          </NativeSelect>
        </div>
        <p id="reminder-hour-note" className="text-xs text-muted-foreground">
          {`Get a reminder at ${selectedLabel} ET if a dose due by then or the check-in isn't logged yet.`}
        </p>
      </div>

      {recipients.length > 0 && (
        <ul className="divide-y">
          {recipients.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <label className="flex min-h-10 min-w-0 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={r.enabled === 1}
                  onChange={() => toggleEnabled(r.id, r.enabled)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="min-w-0 break-words text-sm">
                  <span className="text-xs text-muted-foreground mr-1.5">
                    {TYPE_LABELS[r.type] ?? r.type}
                  </span>
                  {r.destination}
                </span>
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeRecipient(r.id)}
                className="text-destructive hover:text-destructive"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && <FormMessage kind="error">{error}</FormMessage>}

      <div className={cn("space-y-3", recipients.length > 0 && "border-t pt-4")}>
        <h3 className="text-sm font-medium">Add Recipient</h3>
        <div className="flex items-center gap-2">
          <Label htmlFor="new-recipient-type" className="sr-only">
            Send by
          </Label>
          <div className="w-24 shrink-0">
            <NativeSelect
              id="new-recipient-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value as "email" | "sms")}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </NativeSelect>
          </div>
          <Label htmlFor="new-recipient-destination" className="sr-only">
            {newType === "email" ? "Email address" : "Phone number"}
          </Label>
          <Input
            id="new-recipient-destination"
            type={newType === "email" ? "email" : "tel"}
            placeholder={newType === "email" ? "email@example.com" : "+1234567890"}
            value={newDestination}
            onChange={(e) => setNewDestination(e.target.value)}
            className="h-10 min-w-0 flex-1 sm:h-9"
          />
          <Button
            onClick={addRecipient}
            disabled={saving || !newDestination.trim()}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
