import Link from "next/link";
import type { EpisodePatternSummary } from "@/lib/episode-pattern";

export function EpisodePatternBanner({
  tier,
  direction,
  flaggedDays,
}: EpisodePatternSummary) {
  return (
    <div
      className={`rounded-lg p-4 ${
        tier === "alert"
          ? "bg-red-500/10 border border-red-500/30 text-red-300"
          : tier === "warning"
            ? "bg-amber-500/10 border border-amber-500/30 text-amber-300"
            : "bg-muted border text-muted-foreground"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded ${
            tier === "alert"
              ? "bg-red-500/20 text-red-300"
              : tier === "warning"
                ? "bg-amber-500/20 text-amber-300"
                : "bg-blue-500/20 text-blue-300"
          }`}
        >
          {tier.toUpperCase()}
        </span>
        <p className="font-medium">
          {flaggedDays} flagged day{flaggedDays !== 1 ? "s" : ""} in the last 14 days
        </p>
      </div>
      <p className="text-sm mt-1 opacity-80">
        {direction === "hyper"
          ? "Higher-activation"
          : direction === "hypo"
            ? "Lower-activation"
            : "Mixed"}{" "}
        personal-baseline pattern; this is not a mood-episode diagnosis.
      </p>
      <Link
        href="/dashboard/alerts"
        className="text-sm underline mt-2 inline-block"
      >
        View all alerts
      </Link>
    </div>
  );
}
