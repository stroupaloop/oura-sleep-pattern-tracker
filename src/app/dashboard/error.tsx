"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";

/** A page that failed to load says so, and offers to try again. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard page failed:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Callout tone="alert" icon={TriangleAlert} role="alert" title="This page didn't load">
        <p>
          Something failed while reading the data. Trying again usually works;
          if it keeps happening, the reference below helps trace it.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs">Reference {error.digest}</p>
        )}
      </Callout>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
