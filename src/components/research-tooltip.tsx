"use client";

import { Popover } from "radix-ui";
import { CircleHelp } from "lucide-react";
import {
  getReferencesForMetric,
  type ResearchReference,
} from "@/lib/research/references";

function ReferenceCard({
  reference,
}: {
  reference: ResearchReference;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{reference.title}</p>
      <p className="text-xs text-muted-foreground">
        {reference.authors} · {reference.journal},{" "}
        {reference.year}
      </p>
      <p className="text-xs">{reference.finding}</p>
      <a
        href={reference.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary underline decoration-primary/40 hover:decoration-primary"
      >
        View study &rarr;
      </a>
    </div>
  );
}

export function ResearchTooltip({ metric }: { metric: string }) {
  const refs = getReferencesForMetric(metric);

  if (refs.length === 0) return null;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="relative ml-1 inline-flex size-6 cursor-pointer items-center justify-center rounded-full align-middle text-muted-foreground transition-colors after:absolute after:-inset-2 hover:text-foreground"
          aria-label="View research"
        >
          <CircleHelp aria-hidden="true" className="size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 max-h-(--radix-popover-content-available-height) w-[min(20rem,calc(100vw-2rem))] space-y-3 overflow-y-auto rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <p className="text-xs font-semibold text-muted-foreground">
            Related research
          </p>
          {refs.map((reference) => (
            <ReferenceCard
              key={reference.id}
              reference={reference}
            />
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function ResearchBadge({
  reference,
}: {
  reference: ResearchReference;
}) {
  return (
    <a
      href={reference.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {reference.authors}, {reference.journal}, {reference.year} →
    </a>
  );
}
