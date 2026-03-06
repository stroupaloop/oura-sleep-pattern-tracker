"use client";

import { useEffect, useState } from "react";

interface ScoreRingProps {
  score: number | null;
  label: string;
  size?: number;
  sublabel?: string;
}

function getColor(score: number): string {
  if (score < 60) return "#ef4444";
  if (score < 75) return "#f59e0b";
  if (score < 85) return "#22c55e";
  return "#4ade80";
}

export function ScoreRing({ score, label, size = 120, sublabel }: ScoreRingProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const offset = circumference - (normalizedScore / 100) * circumference;
  const color = score != null ? getColor(score) : "#525252";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="oklch(1 0 0 / 8%)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={mounted ? offset : circumference}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground">
            {score ?? "--"}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {sublabel && (
        <span className="text-xs text-muted-foreground">{sublabel}</span>
      )}
    </div>
  );
}
