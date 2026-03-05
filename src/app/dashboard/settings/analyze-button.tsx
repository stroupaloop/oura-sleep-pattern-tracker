"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AnalyzeAllButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/oura/analyze", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(
          `Analyzed ${data.daysAnalyzed} days, found ${data.anomaliesFound} anomalies`
        );
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (e) {
      setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={handleAnalyze} disabled={loading}>
        {loading ? "Analyzing all days..." : "Run Anomaly Analysis"}
      </Button>
      {result && (
        <p className="text-sm text-muted-foreground">{result}</p>
      )}
    </div>
  );
}
