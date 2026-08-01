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
  if (score < 70) return "#f59e0b";
  if (score < 85) return "#22c55e";
  return "#4ade80";
}

function getCategory(score: number): string {
  if (score < 60) return "Pay Attention";
  if (score < 70) return "Fair";
  if (score < 85) return "Good";
  return "Optimal";
}

export function ScoreRing({ score, label, size = 120, sublabel }: ScoreRingProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedScore = score != null ? Math.min(100, Math.max(0, score)) : 0;
  const offset = circumference - (normalizedScore / 100) * circumference;
  const color = score != null ? getColor(score) : "#525252";
  const category = score != null ? getCategory(score) : null;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative"
        style={{ width: size, height: size }}
        role={score != null ? "meter" : "status"}
        aria-label={label}
        aria-valuemin={score != null ? 0 : undefined}
        aria-valuemax={score != null ? 100 : undefined}
        aria-valuenow={score ?? undefined}
        aria-valuetext={
          score != null && category
            ? `${score} out of 100, ${category}`
            : "No score available"
        }
      >
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-hidden="true"
        >
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
            className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground">
            {score ?? "--"}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {category && (
        <span className="text-xs font-medium text-muted-foreground">
          {category}
        </span>
      )}
      {sublabel && (
        <span className="text-xs text-muted-foreground">{sublabel}</span>
      )}
    </div>
  );
}
