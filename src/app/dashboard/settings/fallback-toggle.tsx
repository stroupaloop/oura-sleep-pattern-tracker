"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Pill } from "@/components/ui/pill";
import { APP_TIME_ZONE } from "@/lib/date-utils";
import type { FallbackSetting } from "@/lib/thoughts-fallback-setting";

function formatWhen(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

export function FallbackToggle({
  initial,
  overriddenByEnv,
}: {
  initial: FallbackSetting;
  /** THOUGHTS_FALLBACK_ENABLED=0 is set, which wins over this switch. */
  overriddenByEnv: boolean;
}) {
  const [setting, setSetting] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/thoughts-fallback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !setting.enabled }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          `${data?.error ?? `Could not save (${res.status})`}. Try again.`
        );
        return;
      }
      setSetting(data as FallbackSetting);
    } catch {
      setError("Network error — could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const status = overriddenByEnv
    ? { label: "Off · set by environment", tone: "neutral" as const }
    : setting.enabled
      ? { label: "On", tone: "calm" as const }
      : { label: "Off", tone: "neutral" as const };

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        Status:
        <Pill tone={status.tone}>{status.label}</Pill>
      </p>
      {overriddenByEnv ? (
        <p className="text-sm text-muted-foreground">
          THOUGHTS_FALLBACK_ENABLED=0 is set for this deployment, so nothing
          is logged automatically whichever way this is set. Remove that
          variable and redeploy to use this switch.
        </p>
      ) : (
        !setting.enabled && (
          <p className="text-sm text-muted-foreground">
            Turning it back on starts a fresh 6–12 hour wait, so nothing is
            logged the moment you switch it.
          </p>
        )
      )}
      {setting.updatedAt !== null && (
        <p className="text-xs text-muted-foreground tabular-nums">
          Last changed {formatWhen(setting.updatedAt)} ET
          {setting.updatedBy ? ` by ${setting.updatedBy}` : ""}
        </p>
      )}
      <Button variant="outline" size="sm" onClick={toggle} disabled={saving}>
        {saving
          ? "Saving..."
          : setting.enabled
            ? "Turn off automatic thoughts"
            : "Turn on automatic thoughts"}
      </Button>
      {error && <FormMessage kind="error">{error}</FormMessage>}
    </div>
  );
}
