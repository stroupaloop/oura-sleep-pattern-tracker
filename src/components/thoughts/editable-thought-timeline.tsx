"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Link2, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  APP_TIME_ZONE,
  etInputValueToUnix,
  unixToEtInputValue,
} from "@/lib/date-utils";
import type { TimelineEntry } from "@/components/thoughts/thought-timeline";
import { ReactionChips } from "@/components/thoughts/reaction-bar";

function describeOpens(count: number): string {
  if (count === 0) return "Not opened yet";
  if (count === 1) return "Opened once";
  return `Opened ${count} times`;
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

function EntryEditor({
  entry,
  onDone,
}: {
  entry: TimelineEntry;
  onDone: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [note, setNote] = useState(entry.note ?? "");
  const [link, setLink] = useState(entry.link ?? "");
  const [when, setWhen] = useState(
    unixToEtInputValue(entry.createdAt) ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function save() {
    const createdAt = etInputValueToUnix(when);
    if (createdAt === null) {
      setError("That date and time could not be read.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/thoughts/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, link, createdAt }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Could not save.");
        return;
      }
      startTransition(() => router.refresh());
      onDone();
    } catch {
      setError("Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/thoughts/${entry.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Could not delete.");
        return;
      }
      startTransition(() => router.refresh());
      onDone();
    } catch {
      setError("Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`note-${entry.id}`}>Note</Label>
        <Textarea
          id={`note-${entry.id}`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="What made you think of her?"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`link-${entry.id}`}>Link</Label>
        <Input
          id={`link-${entry.id}`}
          value={link}
          onChange={(event) => setLink(event.target.value)}
          inputMode="url"
          placeholder="https://instagram.com/reel/..."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`when-${entry.id}`}>When you thought it (ET)</Label>
        <Input
          id={`when-${entry.id}`}
          type="datetime-local"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
        />
      </div>

      {error && <FormMessage kind="error">{error}</FormMessage>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={busy} className="gap-2">
          {busy && (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
          )}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <span className="flex-1" />
        {confirmingDelete ? (
          <>
            <span className="text-xs text-muted-foreground">Delete this?</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={remove}
              disabled={busy}
            >
              Yes, delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
            >
              Keep
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy}
            className="gap-1.5 text-muted-foreground"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

export function EditableThoughtTimeline({
  entries,
}: {
  entries: TimelineEntry[];
}) {
  const [editing, setEditing] = useState<number | null>(null);

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
            {editing === entry.id ? (
              <EntryEditor entry={entry} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatWhen(entry.createdAt)}</span>
                    {isPing && (
                      <span className="inline-flex items-center gap-1">
                        <Heart className="size-3" />
                        Thought of you
                      </span>
                    )}
                    {entry.isAuto && (
                      <span
                        className="rounded border px-1 text-[11px]"
                        title="Logged automatically; only you see this"
                      >
                        auto
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditing(entry.id)}
                    className="-my-1 h-9 shrink-0 gap-1.5 px-2 text-muted-foreground sm:h-7"
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                </div>
                {entry.note && (
                  <p className="mt-1 text-sm whitespace-pre-wrap">{entry.note}</p>
                )}
                {entry.link && (
                  <a
                    href={entry.link}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
                  >
                    <Link2 className="size-3.5" />
                    {hostOf(entry.link)}
                  </a>
                )}
                {entry.link && entry.linkClicks !== undefined && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    · {describeOpens(entry.linkClicks)}
                  </span>
                )}
                {entry.reactions && <ReactionChips reactions={entry.reactions} />}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
