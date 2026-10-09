"use client";

import { useState } from "react";
import type { SENSITIVITY_PRESETS } from "@/lib/analysis/config";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/segmented-control";

export type SensitivityPreset = keyof typeof SENSITIVITY_PRESETS;

type Choice = SensitivityPreset | "custom";

const PRESET_OPTIONS: SegmentedOption<Choice>[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const CUSTOM_OPTION: SegmentedOption<Choice> = {
  value: "custom",
  label: "Custom",
};

interface Result {
  message: string;
  kind: "status" | "error";
}

/**
 * Opens on the sensitivity that is saved, so the page never claims a preset
 * the detector is not using. Saved thresholds that match no preset show as
 * Custom until a preset replaces them.
 */
export function DetectionConfig({
  savedPreset,
}: {
  savedPreset: SensitivityPreset | null;
}) {
  const [saved, setSaved] = useState<SensitivityPreset | null>(savedPreset);
  const [choice, setChoice] = useState<Choice>(savedPreset ?? "custom");
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const options = saved ? PRESET_OPTIONS : [...PRESET_OPTIONS, CUSTOM_OPTION];

  async function handleSavePreset() {
    if (choice === "custom") return;
    const preset = choice;
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/oura/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset, notes: `Sensitivity preset: ${preset}` }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(preset);
        const reprocessRes = await fetch("/api/oura/reprocess", {
          method: "POST",
        });
        const reprocessData = await reprocessRes.json();
        if (reprocessRes.ok) {
          setResult({
            kind: "status",
            message:
              `Config v${data.config.version} saved (${preset} sensitivity). ` +
              `Reprocessed ${reprocessData.daysProcessed} days ` +
              `(${reprocessData.episodes.watch} watch, ` +
              `${reprocessData.episodes.warning} warning, ` +
              `${reprocessData.episodes.alert} alert).`,
          });
        } else {
          setResult({
            kind: "error",
            message:
              `Config v${data.config.version} saved, but all-data reprocessing failed: ` +
              `${reprocessData.error ?? "Unknown error"}. Use Reprocess All Data to retry.`,
          });
        }
      } else {
        setResult({ kind: "error", message: `Error: ${data.error}` });
      }
    } catch (e) {
      setResult({
        kind: "error",
        message: `Error: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleReprocess() {
    setReprocessing(true);
    setResult(null);
    try {
      const res = await fetch("/api/oura/reprocess", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult({
          kind: "status",
          message:
            `Reprocessed ${data.daysProcessed} days in ${data.processingTimeMs}ms ` +
            `(${data.episodes.watch} watch, ${data.episodes.warning} warning, ${data.episodes.alert} alert)`,
        });
      } else {
        setResult({ kind: "error", message: `Error: ${data.error}` });
      }
    } catch (e) {
      setResult({
        kind: "error",
        message: `Error: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Sensitivity Preset</p>
        <SegmentedControl
          label="Sensitivity preset"
          options={options}
          value={choice}
          onValueChange={setChoice}
        />
        <p className="text-xs text-muted-foreground">
          {choice === "low" && "Fewer alerts — only strong, sustained patterns trigger warnings."}
          {choice === "medium" && "Balanced — moderate heuristic thresholds for sustained personal-baseline changes."}
          {choice === "high" &&
            "More sensitive — uses lower heuristic thresholds and may flag more ordinary rough nights."}
          {choice === "custom" &&
            "The saved thresholds match no preset. Saving a preset replaces them."}
        </p>
        <p className="text-xs text-muted-foreground">
          Detection combines personal-baseline sleep, physiology, activity,
          and circadian features. Mood and episode check-ins remain context and
          retrospective labels; they do not change the pattern score. The
          pattern profile changes only how much an eased night takes off a
          higher-activation flag, and does not provide a diagnosis.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSavePreset}
          disabled={saving || reprocessing || choice === "custom"}
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

      {result && <FormMessage kind={result.kind}>{result.message}</FormMessage>}
    </div>
  );
}
