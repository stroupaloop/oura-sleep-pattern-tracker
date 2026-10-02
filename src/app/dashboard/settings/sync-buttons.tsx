"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { formatOuraSyncSummary } from "@/lib/oura/sync-summary";
import type { BackfillCoverage } from "@/lib/oura/backfill-coverage";
import { cn } from "@/lib/utils";

interface ResultMessage {
  message: string;
  kind: "status" | "error";
}

function readCoverage(value: unknown): BackfillCoverage | null {
  if (typeof value !== "object" || value === null) return null;
  const coverage = value as Partial<BackfillCoverage>;
  return Array.isArray(coverage.rows) &&
    typeof coverage.windowDays === "number" &&
    typeof coverage.nights === "number" &&
    typeof coverage.checkedNights === "number"
    ? (coverage as BackfillCoverage)
    : null;
}

/** What the backfill left in place, dataset by dataset. */
function CoverageList({ coverage }: { coverage: BackfillCoverage }) {
  return (
    <dl className="divide-y border-y text-sm">
      {coverage.rows.map((row) => (
        <div
          key={row.dataset}
          className="flex items-center justify-between gap-4 py-2"
        >
          <dt>{row.label}</dt>
          <dd
            className={cn(
              "tabular-nums",
              row.notShared ? "text-attention" : "text-muted-foreground"
            )}
          >
            {row.notShared
              ? "Not shared by Oura"
              : `${row.days}/${coverage.windowDays} days`}
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 py-2">
        <dt>Pattern checks</dt>
        <dd className="text-muted-foreground tabular-nums">
          {coverage.checkedNights}/{coverage.nights} nights
        </dd>
      </div>
    </dl>
  );
}

export function BackfillButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultMessage | null>(null);
  const [coverage, setCoverage] = useState<BackfillCoverage | null>(null);

  async function handleBackfill() {
    setLoading(true);
    setResult(null);
    setCoverage(null);
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
        setCoverage(readCoverage(data.coverage));
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
        {loading ? "Backfilling, about a minute…" : "Backfill Last 90 Days"}
      </Button>
      {result && <FormMessage kind={result.kind}>{result.message}</FormMessage>}
      {coverage && <CoverageList coverage={coverage} />}
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
      {result && <FormMessage kind={result.kind}>{result.message}</FormMessage>}
    </div>
  );
}
