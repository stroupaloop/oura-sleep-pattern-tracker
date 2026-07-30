"use client";

import { useState } from "react";
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
        {reference.authors} &middot; {reference.journal},{" "}
        {reference.year}
      </p>
      <p className="text-xs">{reference.finding}</p>
      <a
        href={reference.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-400 hover:text-blue-300"
      >
        View study &rarr;
      </a>
    </div>
  );
}

export function ResearchTooltip({ metric }: { metric: string }) {
  const [open, setOpen] = useState(false);
  const refs = getReferencesForMetric(metric);

  if (refs.length === 0) return null;

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-blue-400 hover:text-blue-300 ml-1 cursor-pointer"
        aria-label="View research"
      >
        [?]
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 bottom-full left-0 mb-2 w-80 bg-popover border rounded-lg shadow-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Related research
            </p>
            {refs.map((reference) => (
              <ReferenceCard
                key={reference.id}
                reference={reference}
              />
            ))}
          </div>
        </>
      )}
    </span>
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
      {reference.authors}, {reference.journal}, {reference.year} &rarr;
    </a>
  );
}
