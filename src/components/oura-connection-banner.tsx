import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OuraConnectionHealth } from "@/lib/oura/connection-health";

function formatEtDay(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
}

/**
 * A failed connection silently starves every chart and the early-warning
 * checks, so it interrupts the whole dashboard until it recovers.
 */
export function OuraConnectionBanner({
  health,
  canReconnect,
}: {
  health: OuraConnectionHealth;
  canReconnect: boolean;
}) {
  const since =
    health.lastSyncedAt != null ? formatEtDay(health.lastSyncedAt) : null;
  const title = health.needsReconnect
    ? since
      ? `Oura has been disconnected since ${since}`
      : "Oura is disconnected"
    : since
      ? `Oura hasn't synced since ${since}`
      : "Oura sync is failing";
  const detail = health.needsReconnect
    ? "Oura rejected the app's connection. Nights after that aren't shown here, and early-warning checks are paused until it's reconnected."
    : "The last few sync attempts failed. Nights after that aren't shown here yet.";

  return (
    <div
      role="status"
      className="flex flex-col gap-3 border-b border-attention/30 bg-attention/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-6"
    >
      <div className="flex min-w-0 gap-2.5">
        <TriangleAlert
          className="mt-0.5 size-4 shrink-0 text-attention"
          aria-hidden="true"
        />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">
            {detail}
            {!canReconnect &&
              " The private-data owner can reconnect it in Settings."}
          </p>
        </div>
      </div>
      {canReconnect && (
        <Button asChild size="sm" className="shrink-0 self-start sm:self-auto">
          <Link href="/dashboard/settings#oura">
            {health.needsReconnect ? "Reconnect Oura" : "Check sync"}
          </Link>
        </Button>
      )}
    </div>
  );
}
