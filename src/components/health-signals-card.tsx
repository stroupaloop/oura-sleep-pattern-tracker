"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface HealthSignalData {
  day: string;
  signalType: string;
  status: string;
  confidence: number;
  indicators: string[];
  summary: string;
}

interface HealthSignalsCardProps {
  signals: HealthSignalData[];
}

const SIGNAL_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  early_pregnancy: { label: "Pregnancy Indicator", color: "text-pink-400", bgColor: "bg-pink-500/10 border-pink-500/30" },
  acute_illness: { label: "Possible Illness", color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/30" },
  cycle_irregularity: { label: "Cycle Irregularity", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/30" },
};

export function HealthSignalsCard({ signals }: HealthSignalsCardProps) {
  const active = signals.filter((s) => s.status === "detected" && s.confidence >= 0.2);

  if (active.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Health Signals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {active.map((signal) => {
          const config = SIGNAL_CONFIG[signal.signalType] ?? {
            label: signal.signalType,
            color: "text-gray-400",
            bgColor: "bg-gray-500/10 border-gray-500/30",
          };
          return (
            <div
              key={`${signal.day}-${signal.signalType}`}
              className={`rounded-lg border p-4 ${config.bgColor}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(signal.confidence * 100)}% confidence
                </span>
              </div>
              <p className="text-sm mb-2">{signal.summary}</p>
              <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                <div
                  className={`h-1.5 rounded-full ${
                    signal.confidence >= 0.7 ? "bg-red-500" :
                    signal.confidence >= 0.4 ? "bg-amber-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.round(signal.confidence * 100)}%` }}
                />
              </div>
              <ul className="space-y-1">
                {signal.indicators.map((ind, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="shrink-0 mt-0.5">-</span>
                    <span>{ind}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3 italic">
                {signal.signalType === "early_pregnancy"
                  ? "This is based on physiological patterns only. Consult a healthcare provider for confirmation."
                  : signal.signalType === "acute_illness"
                    ? "Monitor your symptoms. Rest and hydrate if feeling unwell."
                    : "Cycle variation is normal but persistent changes may warrant medical attention."}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
