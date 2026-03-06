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
        setStatus("Saved. Reprocess recommended to apply new profile.");
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
        <label className="text-sm font-medium">Bipolar Type</label>
        <div className="flex gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
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
            Bipolar I involves manic episodes with dramatic sleep reduction.
            Standard detection thresholds work well. Bounce-back penalty is
            reduced to catch sustained patterns.
          </p>
        )}
        {selected === "bp2" && (
          <p>
            Bipolar II involves hypomanic episodes with subtler changes. The
            system gives extra weight to within-night sleep variability &mdash;
            the strongest early signal for hypomania (94% sensitivity).
          </p>
        )}
        {selected === "unspecified" && (
          <p>
            Default profile uses balanced thresholds suitable for general
            monitoring. Select your type for more tailored detection.
          </p>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save"}
      </Button>

      {status && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}
    </div>
  );
}
