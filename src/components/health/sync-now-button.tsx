"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function describeFailure(error: unknown): string {
  return typeof error === "string" && /token_refresh|HTTP 401|daily scope/.test(error)
    ? "Oura rejected the connection. Reconnect it in Settings."
    : "Sync didn't finish. Try again in a minute.";
}

/**
 * Pulls the past week from Oura now instead of waiting for the next
 * scheduled sync, then re-renders the page with what arrived.
 */
export function SyncNowButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/oura/sync", { method: "POST" });
      const body: { error?: unknown } = await response
        .json()
        .catch(() => ({}));
      if (!response.ok) {
        setMessage(describeFailure(body.error));
        return;
      }
      setMessage("Up to date.");
      router.refresh();
    } catch {
      setMessage("Sync didn't finish. Check the connection and try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        onClick={sync}
        disabled={syncing}
        className="h-10 sm:h-9"
      >
        <RefreshCw
          aria-hidden="true"
          className={cn("size-4", syncing && "animate-spin motion-reduce:animate-none")}
        />
        {syncing ? "Syncing…" : "Sync now"}
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
