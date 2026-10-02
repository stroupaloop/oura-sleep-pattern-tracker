import Link from "next/link";
import { CircleCheck, CirclePause, TriangleAlert } from "lucide-react";
import { Callout } from "@/components/ui/callout";
import type { EpisodePatternSummary } from "@/lib/episode-pattern";
import { formatNightLabel } from "@/lib/health/format";
import { describePatternDirection } from "@/lib/design/pattern-direction";
import { isPatternTier, tierLabel, tierTone } from "@/lib/design/pattern-tiers";

/**
 * The 14-day pattern check in one line: the flag when there is one,
 * otherwise when it last ran, or why it is not running.
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
  if (pattern && isPatternTier(pattern.tier)) {
    const direction = describePatternDirection(pattern.direction);
    return (
      <section aria-label="Pattern check" className={className}>
        <Callout
          tone={tierTone(pattern.tier)}
          icon={TriangleAlert}
          title={`${tierLabel(pattern.tier)}: ${pattern.flaggedDays} flagged day${
            pattern.flaggedDays === 1 ? "" : "s"
          } in the last 14 days`}
        >
          <p>
            {direction.adjective} personal-baseline pattern; this is not a
            mood-episode diagnosis.
          </p>
          <Link
            href="/dashboard/alerts"
            className="mt-1 inline-block font-medium text-foreground underline decoration-border hover:decoration-current"
          >
            View all alerts
          </Link>
        </Callout>
      </section>
    );
  }

  return (
    <section aria-label="Pattern check" className={className}>
      <Callout
        tone="neutral"
        icon={paused ? CirclePause : CircleCheck}
        title={
          paused
            ? "Pattern checks are paused"
            : latestCheckedDay
              ? "No pattern flags in the last 14 days"
              : "Pattern checks haven't run yet"
        }
      >
        <p>
          {paused
            ? "They need new nights from Oura; reconnecting resumes them."
            : latestCheckedDay
              ? `Checked through the night of ${formatNightLabel(latestCheckedDay, { weekday: false })}.`
              : "They start once there are 14 nights to compare with."}
        </p>
        <Link
          href="/dashboard/methodology"
          className="mt-1 inline-block underline decoration-border hover:text-foreground"
        >
          How patterns are checked
        </Link>
      </Callout>
    </section>
  );
}
