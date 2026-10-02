"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { formatIsoDay } from "@/lib/date-utils";
import type { Tone } from "@/lib/design/tone";

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
}

const SUSTAINED_TEMPERATURE_CONFIG: SignalConfig = {
    label: "Sustained Temperature Pattern",
    summary:
      "Temperature and related trends matched this app's sustained-pattern rule.",
    guidance:
      "This nonspecific pattern cannot establish ovulation, pregnancy, or illness. Consider symptoms, an appropriate test, or clinical advice when relevant.",
};

const THERMAL_SHIFT_TIMING_CONFIG: SignalConfig = {
    label: "Thermal-Shift Timing Change",
    summary: "The latest detected thermal-shift interval differed from recent intervals.",
    guidance:
      "Temperature-pattern timing can vary for many reasons and does not establish menstrual-cycle events.",
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
  },
  thermal_shift_timing: THERMAL_SHIFT_TIMING_CONFIG,
  cycle_irregularity: THERMAL_SHIFT_TIMING_CONFIG,
};

/** Evidence strength in words; its tone says how much, never a verdict. */
function getEvidencePresentation(score: number): {
  label: string;
  tone: Tone;
} {
  if (score >= 0.7) return { label: "Higher", tone: "attention" };
  if (score >= 0.4) return { label: "Moderate", tone: "info" };
  return { label: "Limited", tone: "neutral" };
}

export function HealthSignalsCard({ signals }: HealthSignalsCardProps) {
  const detected = signals.filter((s) => s.status === "detected");

  if (detected.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Health Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {detected.map((signal) => {
            const config = SIGNAL_CONFIG[signal.signalType] ?? {
              label: signal.signalType,
              summary:
                "A stored app rule matched one or more recent measurements.",
              guidance:
                "This signal is informational and is not a medical diagnosis.",
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
              <li
                key={`${signal.day}-${signal.signalType}`}
                className="space-y-2 py-4 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium">{config.label}</p>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    <p className="tabular-nums">
                      Signal date: {formatIsoDay(signal.day) ?? signal.day}
                    </p>
                    <p>Current status not confirmed</p>
                  </div>
                </div>
                <p className="text-sm">{config.summary}</p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  Evidence strength:
                  <Pill tone={evidence.tone}>{evidence.label}</Pill>
                </p>
                <ul className="space-y-1">
                  {visibleIndicators.map((ind, i) => (
                    <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                      <span aria-hidden="true" className="mt-0.5 shrink-0">-</span>
                      <span>{ind}</span>
                    </li>
                  ))}
                </ul>
                <p className="pt-1 text-xs text-muted-foreground italic">
                  {config.guidance}
                </p>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
