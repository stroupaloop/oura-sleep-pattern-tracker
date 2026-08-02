"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function AnalyzeButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  async function handleAnalyze() {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/oura/reprocess", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus(`Updated ${data.daysProcessed} historical days.`);
        router.refresh();
      } else {
        setStatus(`Update failed: ${data.error}`);
      }
    } catch (e) {
      setStatus(
        `Update failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1 sm:text-right">
      <Button onClick={handleAnalyze} disabled={loading}>
        {loading ? "Updating history..." : "Update all history"}
      </Button>
      {status && (
        <p className="text-xs text-muted-foreground" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
