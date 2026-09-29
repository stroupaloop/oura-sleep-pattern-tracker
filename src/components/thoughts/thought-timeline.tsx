import { Heart, Link2 } from "lucide-react";
import { APP_TIME_ZONE } from "@/lib/date-utils";
import type { ThoughtReaction } from "@/lib/reaction-emojis";
import { ReactionBar } from "@/components/thoughts/reaction-bar";

export interface TimelineEntry {
  id: number;
  note: string | null;
  link: string | null;
  createdAt: number;
  /** Times a reader has opened the link; shown only to authors. */
  linkClicks?: number;
  /** Logged by the quiet-hours cron; shown only to authors. */
  isAuto?: boolean;
  /** Undefined when they could not be loaded. */
  reactions?: ThoughtReaction[];
}

function formatWhen(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

function hostOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

export function ThoughtTimeline({
  entries,
  viewerEmail,
  recents = [],
}: {
  entries: TimelineEntry[];
  viewerEmail?: string | null;
  recents?: string[];
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {entries.map((entry) => {
        const isPing = !entry.note && !entry.link;
        return (
          <li key={entry.id} className="px-3 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatWhen(entry.createdAt)}</span>
              {isPing && (
                <span className="inline-flex items-center gap-1">
                  <Heart className="size-3" />
                  Thought of you
                </span>
              )}
            </div>
            {entry.note && (
              <p className="mt-1 text-sm whitespace-pre-wrap">{entry.note}</p>
            )}
            {entry.link && (
              <a
                href={`/api/thoughts/${entry.id}/link`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
              >
                <Link2 className="size-3.5" />
                {hostOf(entry.link)}
              </a>
            )}
            {viewerEmail && entry.reactions && (
              <ReactionBar
                thoughtId={entry.id}
                reactions={entry.reactions}
                viewerEmail={viewerEmail}
                recents={recents}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
