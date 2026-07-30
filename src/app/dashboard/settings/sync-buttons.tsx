"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatOuraSyncSummary } from "@/lib/oura/sync-summary";

interface ResultMessage {
  message: string;
  kind: "status" | "error";
}

export function BackfillButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultMessage | null>(null);

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
        setResult({
          message: formatOuraSyncSummary(data, {
            operation: "Backfill",
            includeRange: true,
          }),
          kind: "status",
        });
      } else {
        setResult({ message: `Error: ${data.error}`, kind: "error" });
      }
    } catch (e) {
      setResult({
        message: `Error: ${e instanceof Error ? e.message : String(e)}`,
        kind: "error",
      });
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
        <p
          className="text-sm text-muted-foreground"
          role={result.kind === "error" ? "alert" : "status"}
          aria-live={result.kind === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

export function ManualSyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultMessage | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/oura/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setResult({
          message: formatOuraSyncSummary(data, { operation: "Sync" }),
          kind: "status",
        });
      } else {
        setResult({ message: `Error: ${data.error}`, kind: "error" });
      }
    } catch (e) {
      setResult({
        message: `Error: ${e instanceof Error ? e.message : String(e)}`,
        kind: "error",
      });
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
        <p
          className="text-sm text-muted-foreground"
          role={result.kind === "error" ? "alert" : "status"}
          aria-live={result.kind === "error" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
