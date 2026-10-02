import Link from "next/link";
import { CircleCheck, CirclePause, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EpisodePatternSummary } from "@/lib/episode-pattern";
import { formatNightLabel } from "@/lib/health/format";

const TIER_STYLES: Record<
  string,
  { label: string; surface: string; icon: string }
> = {
  alert: {
    label: "Alert",
    surface: "border-alert/30 bg-alert/8",
    icon: "text-alert",
  },
  warning: {
    label: "Warning",
    surface: "border-attention/30 bg-attention/8",
    icon: "text-attention",
  },
  watch: {
    label: "Watch",
    surface: "border-watch/30 bg-watch/8",
    icon: "text-watch",
  },
};

function describeDirection(direction: string | null): string {
  if (direction === "hyper") return "Higher-activation";
  if (direction === "hypo") return "Lower-activation";
  return "Mixed";
}

/**
 * The 14-day pattern check in one line, always present: a flag when there is
 * one, otherwise when it last ran, or why it is not running.
 */
export function PatternStatus({
  pattern,
  latestCheckedDay,
  paused,
  className,
}: {
  pattern: EpisodePatternSummary | null;
  latestCheckedDay: string | null;
  paused: boolean;
  className?: string;
}) {
  const tier = pattern ? TIER_STYLES[pattern.tier] : undefined;

  if (pattern && tier) {
    return (
      <section
        aria-label="Pattern check"
        className={cn("rounded-xl border p-4", tier.surface, className)}
      >
        <div className="flex gap-3">
          <TriangleAlert
            aria-hidden="true"
            className={cn("mt-0.5 size-4 shrink-0", tier.icon)}
          />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold">
              {tier.label}: {pattern.flaggedDays} flagged day
              {pattern.flaggedDays === 1 ? "" : "s"} in the last 14 days
            </p>
            <p className="text-sm text-muted-foreground">
              {describeDirection(pattern.direction)} personal-baseline
              pattern; this is not a mood-episode diagnosis.
            </p>
            <Link
              href="/dashboard/alerts"
              className="inline-block text-sm font-medium underline decoration-border hover:decoration-current"
            >
              View all alerts
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const Icon = paused ? CirclePause : CircleCheck;
  return (
    <section
      aria-label="Pattern check"
      className={cn("rounded-xl border bg-card p-4", className)}
    >
      <div className="flex gap-3">
        <Icon
          aria-hidden="true"
          className={cn(
            "mt-0.5 size-4 shrink-0",
            paused ? "text-muted-foreground" : "text-calm"
          )}
        />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">
            {paused
              ? "Pattern checks are paused"
              : latestCheckedDay
                ? "No pattern flags in the last 14 days"
                : "Pattern checks haven't run yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {paused
              ? "They need new nights from Oura; reconnecting resumes them."
              : latestCheckedDay
                ? `Checked through the night of ${formatNightLabel(latestCheckedDay, { weekday: false })}.`
                : "They start once there are 14 nights to compare with."}
          </p>
          <Link
            href="/dashboard/methodology"
            className="inline-block text-sm text-muted-foreground underline decoration-border hover:text-foreground"
          >
            How patterns are checked
          </Link>
        </div>
      </div>
    </section>
  );
}
