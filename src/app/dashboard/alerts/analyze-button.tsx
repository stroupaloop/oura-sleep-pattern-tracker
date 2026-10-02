"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { useRouter } from "next/navigation";

export function AnalyzeButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    kind: "status" | "error";
    text: string;
  } | null>(null);
  const router = useRouter();

  async function handleAnalyze() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/oura/reprocess", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          kind: "status",
          text: `Updated ${data.daysProcessed} historical days.`,
        });
        router.refresh();
      } else {
        setStatus({ kind: "error", text: `Update failed: ${data.error}` });
      }
    } catch (e) {
      setStatus({
        kind: "error",
        text: `Update failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1 sm:text-right">
      <Button onClick={handleAnalyze} disabled={loading}>
        {loading ? "Updating history..." : "Update all history"}
      </Button>
      <FormMessage kind={status?.kind} className="text-xs tabular-nums">
        {status?.text}
      </FormMessage>
    </div>
  );
}
