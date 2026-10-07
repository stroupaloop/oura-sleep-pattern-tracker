import Link from "next/link";
import {
  CircleCheck,
  CircleDashed,
  CirclePause,
  Clock,
  History,
  TriangleAlert,
} from "lucide-react";
import { Callout } from "@/components/ui/callout";
import { getTodayET } from "@/lib/date-utils";
import {
  isPatternCheckBehind,
  type EpisodePatternSummary,
} from "@/lib/episode-pattern";
import { formatNightLabel } from "@/lib/health/format";
import { describePatternDirection } from "@/lib/design/pattern-direction";
import { isPatternTier, tierLabel, tierTone } from "@/lib/design/pattern-tiers";

function nightOf(day: string): string {
  return formatNightLabel(day, { weekday: false });
}

function behindFix(canSync: boolean): string {
  return canSync
    ? "Open the Oura app to sync, then tap Sync now."
    : "It catches up once the Oura app on the phone syncs the ring.";
}

/**
 * The 14-day pattern check in one line: the flag when there is one, when it
 * last flagged once it has eased, otherwise when the check last ran, or why
 * it is not running or is behind.
 */
export function PatternStatus({
  pattern,
  latestCheckedDay,
  paused,
  canSync = false,
  today = getTodayET(),
  className,
}: {
  pattern: EpisodePatternSummary | null;
  latestCheckedDay: string | null;
  paused: boolean;
  /** Whether this viewer has the Sync now button to point to. */
  canSync?: boolean;
  /** The ET day to measure the check against; defaults to now. */
  today?: string;
  className?: string;
}) {
  const behind = isPatternCheckBehind(latestCheckedDay, today);
  const flagged = pattern && isPatternTier(pattern.tier) ? pattern : null;

  if (flagged && !flagged.eased) {
    const direction = describePatternDirection(flagged.direction);
    return (
      <section aria-label="Pattern check" className={className}>
        <Callout
          tone={tierTone(flagged.tier)}
          icon={TriangleAlert}
          title={`${tierLabel(flagged.tier)}: ${flagged.flaggedDays} flagged day${
            flagged.flaggedDays === 1 ? "" : "s"
          } in the last 14 days`}
        >
          <p>
            {direction.adjective} personal-baseline pattern; this is not a
            mood-episode diagnosis.
          </p>
          {behind && latestCheckedDay && (
            <p className="mt-1">
              {`The check is behind: it last ran through the night of ${nightOf(latestCheckedDay)}. ${behindFix(canSync)}`}
            </p>
          )}
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

  if (flagged && !paused && !behind) {
    return (
      <section aria-label="Pattern check" className={className}>
        <Callout tone="neutral" icon={History} title="Pattern flag has eased">
          <p>
            {`Last flagged the night of ${nightOf(flagged.lastFlaggedDay)}; the latest nights are back near usual.`}
          </p>
          <p className="mt-1">
            {`${flagged.flaggedDays} flagged day${
              flagged.flaggedDays === 1 ? "" : "s"
            } in the last 14 days.${
              latestCheckedDay
                ? ` Checked through the night of ${nightOf(latestCheckedDay)}.`
                : ""
            }`}
          </p>
          <Link
            href="/dashboard/alerts"
            className="mt-1 inline-block underline decoration-border hover:text-foreground"
          >
            View all alerts
          </Link>
        </Callout>
      </section>
    );
  }

  if (!paused && behind && latestCheckedDay) {
    return (
      <section aria-label="Pattern check" className={className}>
        <Callout tone="info" icon={Clock} title="Pattern check is behind">
          <p>
            {`Last checked: the night of ${nightOf(latestCheckedDay)}. Newer nights haven't reached the app, so the last 14 days aren't fully covered.${
              flagged
                ? ` A pattern was last flagged the night of ${nightOf(flagged.lastFlaggedDay)}.`
                : ""
            }`}
          </p>
          <p className="mt-1">{behindFix(canSync)}</p>
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

  const neverRan = !paused && !latestCheckedDay;
  return (
    <section aria-label="Pattern check" className={className}>
      <Callout
        tone="neutral"
        icon={paused ? CirclePause : neverRan ? CircleDashed : CircleCheck}
        iconClassName={paused || neverRan ? undefined : "text-calm"}
        title={
          paused
            ? "Pattern checks are paused"
            : neverRan
              ? "Pattern checks haven't run yet"
              : "No pattern flags in the last 14 days"
        }
      >
        <p>
          {paused
            ? "They need new nights from Oura; reconnecting resumes them."
            : latestCheckedDay
              ? `Checked through the night of ${nightOf(latestCheckedDay)}.`
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
