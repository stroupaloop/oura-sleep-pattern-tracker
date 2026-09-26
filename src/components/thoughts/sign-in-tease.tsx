import Link from "next/link";
import { Link2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_TIME_ZONE } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

/**
 * What a signed-out visitor is allowed to know about a note: when it was
 * written, whether it carries a link, and roughly how long it is. The text
 * itself is never queried for this render, so it cannot leak.
 */
export interface NotePreview {
  id: number;
  createdAt: number;
  hasLink: boolean;
  size: "short" | "medium" | "long";
}

const BAR_WIDTHS: Record<NotePreview["size"], string[]> = {
  short: ["58%"],
  medium: ["92%", "44%"],
  long: ["96%", "88%", "61%"],
};

function formatWhen(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

export function SignInTease({
  noteCount,
  previews,
}: {
  noteCount: number;
  previews: NotePreview[];
}) {
  const hasNotes = noteCount > 0;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        {hasNotes ? (
          <>
            {noteCount === 1
              ? "One of these carries a note"
              : `${noteCount} of these carry a note`}{" "}
            — what set it off, a reel I wanted you to see, something I saved to
            show you later.
          </>
        ) : (
          <>
            The count is only half of it. Notes get attached as they happen —
            what set it off, a reel I wanted you to see.
          </>
        )}
      </p>

      {previews.length > 0 && (
        <ul className="space-y-2" aria-hidden>
          {previews.map((preview) => (
            <li
              key={preview.id}
              className="rounded-md border border-dashed px-3 py-2.5"
            >
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Lock className="size-3" />
                {formatWhen(preview.createdAt)}
                {preview.hasLink && <Link2 className="size-3" />}
              </div>
              <div className="mt-1.5 space-y-1.5">
                {BAR_WIDTHS[preview.size].map((width, index) => (
                  <div
                    key={index}
                    className={cn("h-2 rounded-full bg-muted-foreground/20")}
                    style={{ width }}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button asChild className="mt-1">
        <Link href="/login">
          {hasNotes ? "Sign in to read them" : "Sign in to follow along"}
        </Link>
      </Button>
    </div>
  );
}
