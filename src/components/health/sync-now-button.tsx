"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getNowUnixSeconds, getTodayET } from "@/lib/date-utils";
import {
  formatSyncNowFailure,
  formatSyncNowResult,
} from "@/lib/oura/sync-summary";
import { cn } from "@/lib/utils";

type Outcome =
  | { kind: "failed"; message: string }
  | {
      kind: "synced";
      result: unknown;
      latestBefore: string | null;
      syncedAt: number;
    };

/**
 * Pulls the past week from Oura now instead of waiting for the next
 * scheduled sync, then re-renders the page with what arrived. `latestNight`
 * is the newest night on the page, so the message can say when the sync
 * brought nothing newer; it is read again once the page has refreshed.
 */
export function SyncNowButton({ latestNight }: { latestNight: string | null }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  async function sync() {
    setSyncing(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/oura/sync", { method: "POST" });
      const body: { error?: unknown } | null = await response
        .json()
        .catch(() => null);
      if (!response.ok) {
        setOutcome({
          kind: "failed",
          message: formatSyncNowFailure(body?.error),
        });
        return;
      }
      setOutcome({
        kind: "synced",
        result: body,
        latestBefore: latestNight,
        syncedAt: getNowUnixSeconds(),
      });
      startRefresh(() => router.refresh());
    } catch {
      setOutcome({
        kind: "failed",
        message: "Sync didn't finish. Check the connection and try again.",
      });
    } finally {
      setSyncing(false);
    }
  }

  const busy = syncing || refreshing;
  const message =
    busy || !outcome
      ? null
      : outcome.kind === "failed"
        ? outcome.message
        : formatSyncNowResult(outcome.result, {
            latestBefore: outcome.latestBefore,
            latestAfter: latestNight,
            syncedAt: outcome.syncedAt,
            today: getTodayET(),
          });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={sync}
        disabled={busy}
        className="h-10 sm:h-9"
      >
        <RefreshCw
          aria-hidden="true"
          className={cn("size-4", busy && "animate-spin motion-reduce:animate-none")}
        />
        {busy ? "Syncing…" : "Sync now"}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className="max-w-56 text-right text-xs text-muted-foreground empty:hidden"
      >
        {message}
      </p>
    </div>
  );
}
