"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function AnalyzeButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAnalyze() {
    setLoading(true);
    try {
      const res = await fetch("/api/oura/analyze", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        router.refresh();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleAnalyze} disabled={loading}>
      {loading ? "Analyzing..." : "Run Analysis"}
    </Button>
  );
}
