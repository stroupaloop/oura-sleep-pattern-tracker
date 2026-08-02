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
        const reprocessRes = await fetch("/api/oura/reprocess", {
          method: "POST",
        });
        const reprocessData = await reprocessRes.json();
        if (reprocessRes.ok) {
          setStatus(
            `Config v${data.config.version} saved (${preset} sensitivity). ` +
              `Reprocessed ${reprocessData.daysProcessed} days ` +
              `(${reprocessData.episodes.watch} watch, ` +
              `${reprocessData.episodes.warning} warning, ` +
              `${reprocessData.episodes.alert} alert).`
          );
        } else {
          setStatus(
            `Config v${data.config.version} saved, but all-data reprocessing failed: ` +
              `${reprocessData.error ?? "Unknown error"}. Use Reprocess All Data to retry.`
          );
        }
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
        <p id="sensitivity-preset-label" className="text-sm font-medium">
          Sensitivity Preset
        </p>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-labelledby="sensitivity-preset-label"
        >
          {(["low", "medium", "high"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              aria-pressed={preset === p}
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
          {preset === "medium" && "Balanced \u2014 moderate heuristic thresholds for sustained personal-baseline changes."}
          {preset === "high" &&
            "More sensitive — uses lower heuristic thresholds and may flag more confounders."}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Detection combines personal-baseline sleep, physiology, activity,
          and circadian features. Mood and episode check-ins remain context and
          retrospective labels; they do not change the pattern score. The
          pattern profile applies only the documented heuristic weight and
          bounce-back adjustments and does not provide a diagnosis.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSavePreset}
          disabled={saving || reprocessing}
        >
          {saving ? "Saving & Reprocessing..." : "Save Preset & Reprocess"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReprocess}
          disabled={reprocessing || saving}
        >
          {reprocessing ? "Reprocessing..." : "Reprocess All Data"}
        </Button>
      </div>

      {status && (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
