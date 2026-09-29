"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import { SmilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  REACTION_EMOJIS,
  type ThoughtReaction,
} from "@/lib/reaction-emojis";

/** Read-only chips, for the author's view. */
export function ReactionChips({ reactions }: { reactions: ThoughtReaction[] }) {
  if (reactions.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {reactions.map((reaction) => (
        <span
          key={reaction.email}
          title={reaction.email}
          className="rounded-full bg-muted px-1.5 py-0.5 text-sm leading-none"
        >
          {reaction.emoji}
        </span>
      ))}
    </div>
  );
}

export function ReactionBar({
  thoughtId,
  reactions,
  viewerEmail,
  recents,
}: {
  thoughtId: number;
  reactions: ThoughtReaction[];
  viewerEmail: string;
  recents: string[];
}) {
  const viewer = viewerEmail.toLowerCase();
  const others = reactions.filter((reaction) => reaction.email !== viewer);
  const [mine, setMine] = useState<string | null>(
    reactions.find((reaction) => reaction.email === viewer)?.emoji ?? null
  );
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [failed, setFailed] = useState(false);

  async function choose(emoji: string) {
    const previous = mine;
    // Tapping the reaction already chosen takes it back, like a tapback.
    const next = emoji === mine ? null : emoji;
    setMine(next);
    setOpen(false);
    setShowAll(false);
    setFailed(false);
    try {
      const response = await fetch(
        `/api/thoughts/${thoughtId}/reaction`,
        next
          ? {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ emoji: next }),
            }
          : { method: "DELETE" }
      );
      if (!response.ok) throw new Error("save failed");
    } catch {
      setMine(previous);
      setFailed(true);
    }
  }

  const emojiButton = (emoji: string) => (
    <button
      key={emoji}
      type="button"
      onClick={() => choose(emoji)}
      aria-label={`React with ${emoji}`}
      aria-pressed={mine === emoji}
      className={cn(
        "size-9 rounded-md text-xl leading-none transition-colors hover:bg-muted",
        mine === emoji && "bg-muted ring-1 ring-primary/40"
      )}
    >
      {emoji}
    </button>
  );

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {others.map((reaction) => (
        <span
          key={reaction.email}
          title={reaction.email}
          className="rounded-full bg-muted px-1.5 py-0.5 text-sm leading-none"
        >
          {reaction.emoji}
        </span>
      ))}
      {mine && (
        <button
          type="button"
          onClick={() => choose(mine)}
          aria-label={`Remove your ${mine} reaction`}
          className="rounded-full bg-primary/15 px-1.5 py-0.5 text-sm leading-none ring-1 ring-primary/40"
        >
          {mine}
        </button>
      )}
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setShowAll(false);
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Add a reaction"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SmilePlus className="size-3.5" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={4}
            collisionPadding={16}
            className="z-50 rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-md"
          >
            <div className="flex items-center gap-0.5">
              {recents.map(emojiButton)}
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                aria-expanded={showAll}
                className="ml-0.5 h-9 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showAll ? "Less" : "More"}
              </button>
            </div>
            {showAll && (
              <div className="mt-1.5 grid grid-cols-6 gap-0.5 border-t pt-1.5">
                {REACTION_EMOJIS.filter((emoji) => !recents.includes(emoji)).map(
                  emojiButton
                )}
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {failed && (
        <span role="alert" className="text-xs text-red-400">
          Reaction not saved
        </span>
      )}
    </div>
  );
}
