"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type BPType = "bp1" | "bp2" | "unspecified";

const options: { value: BPType; label: string }[] = [
  { value: "bp1", label: "Bipolar I" },
  { value: "bp2", label: "Bipolar II" },
  { value: "unspecified", label: "Not specified" },
];

export function BipolarTypeSelector({ initial }: { initial: string }) {
  const [selected, setSelected] = useState<BPType>(
    (initial as BPType) || "unspecified"
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setStatus(null);
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
          setStatus(
            `Saved and updated ${reprocess.daysProcessed} historical days ` +
              `(${reprocess.episodes.watch} watch, ` +
              `${reprocess.episodes.warning} warning, ` +
              `${reprocess.episodes.alert} alert).`
          );
        } else {
          setStatus(
            `Profile saved, but historical results could not be updated: ${reprocess.error}`
          );
        }
      } else {
        const data = await res.json();
        setStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p id="pattern-profile-label" className="text-sm font-medium">
          Pattern Profile
        </p>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-labelledby="pattern-profile-label"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              aria-pressed={selected === opt.value}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                selected === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-input hover:bg-accent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium">How this affects detection:</p>
        {selected === "bp1" && (
          <p>
            Uses the app&apos;s Bipolar I heuristic profile, which changes how
            sustained activation-leaning patterns are weighted. This profile
            has not been clinically validated.
          </p>
        )}
        {selected === "bp2" && (
          <p>
            Uses the app&apos;s Bipolar II heuristic profile, with more weight
            on within-night variability. That metric is exploratory and is not
            a validated hypomania detector.
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

      {status && (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
