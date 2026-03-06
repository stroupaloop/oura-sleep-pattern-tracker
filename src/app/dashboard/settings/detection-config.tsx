"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Preset = "low" | "medium" | "high";

export function DetectionConfig() {
  const [preset, setPreset] = useState<Preset>("medium");
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSavePreset() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/oura/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset, notes: `Sensitivity preset: ${preset}` }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Config v${data.config.version} saved (${preset} sensitivity)`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleReprocess() {
    setReprocessing(true);
    setStatus(null);
    try {
      const res = await fetch("/api/oura/reprocess", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus(
          `Reprocessed ${data.daysProcessed} days in ${data.processingTimeMs}ms ` +
          `(${data.episodes.watch} watch, ${data.episodes.warning} warning, ${data.episodes.alert} alert)`
        );
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Sensitivity Preset</label>
        <div className="flex gap-2">
          {(["low", "medium", "high"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                preset === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input hover:bg-accent"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {preset === "low" && "Fewer alerts \u2014 only strong, sustained patterns trigger warnings."}
          {preset === "medium" && "Balanced \u2014 aligns with DSM-5 episode duration criteria."}
          {preset === "high" && "More sensitive \u2014 catches earlier signals but may flag more confounders."}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Detection now uses {">"}25 metrics including within-night sleep variability, circadian rhythm analysis, and activity patterns. Your condition profile (set above) adjusts metric weights automatically.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSavePreset}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Preset"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReprocess}
          disabled={reprocessing}
        >
          {reprocessing ? "Reprocessing..." : "Reprocess All Data"}
        </Button>
      </div>

      {status && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}
    </div>
  );
}
