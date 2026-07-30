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
  evidenceScore: number;
  indicators: string[];
}

interface HealthSignalsCardProps {
  signals: HealthSignalData[];
}

interface SignalConfig {
  label: string;
  summary: string;
  guidance: string;
  color: string;
  bgColor: string;
}

const SUSTAINED_TEMPERATURE_CONFIG: SignalConfig = {
    label: "Sustained Temperature Pattern",
    summary:
      "Temperature and related trends matched this app's sustained-pattern rule.",
    guidance:
      "This nonspecific pattern cannot establish ovulation, pregnancy, or illness. Consider symptoms, an appropriate test, or clinical advice when relevant.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
};

const THERMAL_SHIFT_TIMING_CONFIG: SignalConfig = {
    label: "Thermal-Shift Timing Change",
    summary: "The latest detected thermal-shift interval differed from recent intervals.",
    guidance:
      "Temperature-pattern timing can vary for many reasons and does not establish menstrual-cycle events.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/30",
};

const SIGNAL_CONFIG: Record<string, SignalConfig> = {
  sustained_temperature: SUSTAINED_TEMPERATURE_CONFIG,
  early_pregnancy: SUSTAINED_TEMPERATURE_CONFIG,
  acute_illness: {
    label: "Physiological Strain",
    summary:
      "One or more recent measurements differed from your personal baseline.",
    guidance:
      "This is not an illness diagnosis. Consider symptoms and seek medical advice when appropriate.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
  },
  thermal_shift_timing: THERMAL_SHIFT_TIMING_CONFIG,
  cycle_irregularity: THERMAL_SHIFT_TIMING_CONFIG,
};

function getEvidencePresentation(score: number) {
  if (score >= 0.7) {
    return { label: "Higher", width: 100, color: "bg-red-500" };
  }
  if (score >= 0.4) {
    return { label: "Moderate", width: 66, color: "bg-amber-500" };
  }
  return { label: "Limited", width: 33, color: "bg-blue-500" };
}

export function HealthSignalsCard({ signals }: HealthSignalsCardProps) {
  const detected = signals.filter((s) => s.status === "detected");

  if (detected.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Health Signals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {detected.map((signal) => {
          const config = SIGNAL_CONFIG[signal.signalType] ?? {
            label: signal.signalType,
            summary:
              "A stored app rule matched one or more recent measurements.",
            guidance:
              "This signal is informational and is not a medical diagnosis.",
            color: "text-gray-400",
            bgColor: "bg-gray-500/10 border-gray-500/30",
          };
          const evidence = getEvidencePresentation(signal.evidenceScore);
          const isLegacySignal =
            signal.signalType === "early_pregnancy" ||
            signal.signalType === "cycle_irregularity";
          const visibleIndicators = isLegacySignal
            ? [
                "This stored result predates the current rules; legacy reproductive-event details are not shown.",
              ]
            : signal.indicators;
          return (
            <div
              key={`${signal.day}-${signal.signalType}`}
              className={`rounded-lg border p-4 ${config.bgColor}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${config.color}`}>
                  {config.label}
                </span>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Signal date: {signal.day}</p>
                  <p>Current status not confirmed</p>
                </div>
              </div>
              <p className="text-sm mb-2">{config.summary}</p>
              <p className="text-xs text-muted-foreground mb-1">
                Evidence strength: {evidence.label}
              </p>
              <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                <div
                  className={`h-1.5 rounded-full ${evidence.color}`}
                  style={{ width: `${evidence.width}%` }}
                />
              </div>
              <ul className="space-y-1">
                {visibleIndicators.map((ind, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="shrink-0 mt-0.5">-</span>
                    <span>{ind}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-3 italic">
                {config.guidance}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
