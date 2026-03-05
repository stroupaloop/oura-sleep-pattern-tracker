"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function BackfillButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleBackfill() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/oura/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 90 }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Synced ${data.records} records (${data.startDate} to ${data.endDate})`);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleBackfill} disabled={loading}>
        {loading ? "Syncing last 90 days..." : "Backfill Last 90 Days"}
      </Button>
      {result && (
        <p className="text-sm text-muted-foreground">{result}</p>
      )}
    </div>
  );
}

export function ManualSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/oura/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResult(`Synced ${data.records} records`);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={handleSync} disabled={loading}>
        {loading ? "Syncing..." : "Sync Last 7 Days"}
      </Button>
      {result && (
        <p className="text-sm text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
