"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/segmented-control";

type BPType = "bp1" | "bp2" | "unspecified";

const options: SegmentedOption<BPType>[] = [
  { value: "bp1", label: "Bipolar I" },
  { value: "bp2", label: "Bipolar II" },
  { value: "unspecified", label: "Not specified" },
];

function toBPType(value: string): BPType {
  return value === "bp1" || value === "bp2" ? value : "unspecified";
}

interface Result {
  message: string;
  kind: "status" | "error";
}

export function BipolarTypeSelector({ initial }: { initial: string }) {
  const [selected, setSelected] = useState<BPType>(toBPType(initial));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSave() {
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bipolarType: selected }),
      });
      if (res.ok) {
        const reprocessResponse = await fetch("/api/oura/reprocess", {
          method: "POST",
        });
        const reprocess = await reprocessResponse.json();
        if (reprocessResponse.ok) {
          setResult({
            kind: "status",
            message:
              `Saved and updated ${reprocess.daysProcessed} historical days ` +
              `(${reprocess.episodes.watch} watch, ` +
              `${reprocess.episodes.warning} warning, ` +
              `${reprocess.episodes.alert} alert).`,
          });
        } else {
          setResult({
            kind: "error",
            message: `Profile saved, but historical results could not be updated: ${reprocess.error}`,
          });
        }
      } else {
        const data = await res.json();
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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Pattern Profile</p>
        <SegmentedControl
          label="Pattern profile"
          options={options}
          value={selected}
          onValueChange={setSelected}
        />
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium">How this affects detection:</p>
        {selected === "bp1" && (
          <p>
            Uses the app&apos;s Bipolar I heuristic profile. The only
            difference from the default is that one better night takes less
            off the evidence of a higher-activation pattern. This profile has
            not been clinically validated.
          </p>
        )}
        {selected === "bp2" && (
          <p>
            Scores the same as the default. The research does not yet support
            scoring Bipolar II differently, so for now this records which
            profile you chose and nothing else changes.
          </p>
        )}
        {selected === "unspecified" && (
          <p>
            Uses the default heuristic weights. Profile selection changes app
            scoring only and does not make a diagnosis.
          </p>
        )}
        <p>
          Saving recomputes all eligible history so results never silently mix
          profiles. This does not contact Oura or change connection scopes.
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving and updating history..." : "Save profile"}
      </Button>

      {result && <FormMessage kind={result.kind}>{result.message}</FormMessage>}
    </div>
  );
}
