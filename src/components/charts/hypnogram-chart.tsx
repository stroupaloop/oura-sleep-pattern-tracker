"use client";

import { useRef, useState } from "react";

interface HypnogramChartProps {
  hypnogram: string;
  hr5min: string | null;
  bedtimeStart: string;
}

const STAGES = [
  { key: 4, label: "Awake", color: "#f97316", y: 0 },
  { key: 3, label: "REM", color: "#a78bfa", y: 1 },
  { key: 2, label: "Light", color: "#67e8f9", y: 2 },
  { key: 1, label: "Deep", color: "#3b82f6", y: 3 },
] as const;

const stageMap: Record<string, { label: string; value: number; color: string }> = {
  "1": { label: "Deep", value: 1, color: "#3b82f6" },
  "2": { label: "Light", value: 2, color: "#67e8f9" },
  "3": { label: "REM", value: 3, color: "#a78bfa" },
  "4": { label: "Awake", value: 4, color: "#f97316" },
};

const stageRow: Record<number, number> = { 4: 0, 3: 1, 2: 2, 1: 3 };

function formatClockTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

interface DataPoint {
  minuteOffset: number;
  time: string;
  stage: number;
  stageLabel: string;
  hr: number | null;
  color: string;
}

function parseHypnogram(
  hypnogram: string,
  hr5min: string | null,
  bedtimeStart: string
): DataPoint[] {
  const start = new Date(bedtimeStart);
  let hrData: number[] = [];
  if (hr5min) {
    try {
      hrData = JSON.parse(hr5min);
    } catch {
      hrData = [];
    }
  }

  return Array.from(hypnogram).map((char, i) => {
    const info = stageMap[char] ?? { label: "Unknown", value: 2, color: "#525252" };
    const time = new Date(start.getTime() + i * 5 * 60 * 1000);
    return {
      minuteOffset: i * 5,
      time: formatClockTime(time),
      stage: info.value,
      stageLabel: info.label,
      hr: hrData[i] ?? null,
      color: info.color,
    };
  });
}

export function HypnogramChart({ hypnogram, hr5min, bedtimeStart }: HypnogramChartProps) {
  const data = parseHypnogram(hypnogram, hr5min, bedtimeStart);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; point: DataPoint } | null>(null);

  if (data.length === 0) return null;

  const hrData = data.filter((d) => d.hr != null);
  const hrMin = hrData.length > 0 ? Math.min(...hrData.map((d) => d.hr!)) - 5 : 0;
  const hrMax = hrData.length > 0 ? Math.max(...hrData.map((d) => d.hr!)) + 5 : 100;
  const hrRange = hrMax - hrMin || 1;

  const rowHeight = 28;
  const rowGap = 2;
  const chartHeight = STAGES.length * rowHeight + (STAGES.length - 1) * rowGap;

  const tickInterval = Math.max(1, Math.floor(data.length / 6));
  const timeTicks = data.filter((_, i) => i % tickInterval === 0 || i === data.length - 1);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const labelWidth = 48;
    const chartWidth = rect.width - labelWidth;
    const idx = Math.round(((x - labelWidth) / chartWidth) * (data.length - 1));
    if (idx >= 0 && idx < data.length) {
      setTooltip({ x: e.clientX - rect.left, point: data[idx] });
    }
  }

  return (
    <div className="space-y-1">
      <div
        ref={containerRef}
        className="relative select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <div className="flex" style={{ height: chartHeight }}>
          <div className="flex flex-col justify-between shrink-0 w-12 pr-2">
            {STAGES.map((s, i) => (
              <div
                key={s.key}
                className="flex items-center justify-end text-[10px] text-muted-foreground"
                style={{ height: rowHeight }}
              >
                {s.label}
              </div>
            ))}
          </div>

          <div className="relative flex-1 overflow-hidden rounded-md">
            {STAGES.map((s, rowIdx) => (
              <div
                key={s.key}
                className="absolute left-0 right-0 bg-muted/20 rounded-sm"
                style={{
                  top: rowIdx * (rowHeight + rowGap),
                  height: rowHeight,
                }}
              />
            ))}

            {data.map((d, i) => {
              const row = stageRow[d.stage];
              const leftPct = (i / data.length) * 100;
              const widthPct = (1 / data.length) * 100 + 0.1;
              return (
                <div
                  key={i}
                  className="absolute rounded-[1px]"
                  style={{
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    top: row * (rowHeight + rowGap) + 2,
                    height: rowHeight - 4,
                    backgroundColor: d.color,
                    opacity: 0.85,
                  }}
                />
              );
            })}

            {hr5min && hrData.length > 1 && (
              <svg
                className="absolute inset-0 pointer-events-none"
                viewBox={`0 0 ${data.length} ${chartHeight}`}
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeOpacity="0.5"
                  vectorEffect="non-scaling-stroke"
                  points={data
                    .map((d, i) => {
                      if (d.hr == null) return null;
                      const y = chartHeight - ((d.hr - hrMin) / hrRange) * chartHeight;
                      return `${i},${y}`;
                    })
                    .filter(Boolean)
                    .join(" ")}
                />
              </svg>
            )}

            {tooltip && (
              <div
                className="absolute top-0 bottom-0 w-px bg-foreground/30 pointer-events-none"
                style={{ left: `${(data.indexOf(tooltip.point) / data.length) * 100}%` }}
              />
            )}
          </div>

          {hr5min && hrData.length > 1 && (
            <div className="flex flex-col justify-between shrink-0 w-8 pl-1 text-[9px] text-muted-foreground">
              <span>{Math.round(hrMax)}</span>
              <span className="text-[8px]">bpm</span>
              <span>{Math.round(hrMin)}</span>
            </div>
          )}
        </div>

        <div className="flex pl-12 pr-8 mt-1">
          <div className="flex-1 flex justify-between text-[10px] text-muted-foreground">
            {timeTicks.map((t) => (
              <span key={t.minuteOffset}>{t.time}</span>
            ))}
          </div>
        </div>

        {tooltip && (
          <div
            className="absolute z-10 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-md pointer-events-none"
            style={{
              left: Math.min(tooltip.x, (containerRef.current?.clientWidth ?? 300) - 140),
              top: -50,
            }}
          >
            <p className="font-medium text-foreground">{tooltip.point.time}</p>
            <p style={{ color: tooltip.point.color }}>{tooltip.point.stageLabel}</p>
            {tooltip.point.hr != null && (
              <p className="text-muted-foreground">{tooltip.point.hr} bpm</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 justify-center text-[10px] text-muted-foreground mt-2">
        {STAGES.map((s) => (
          <div key={s.key} className="flex items-center gap-1">
            <span
              className="w-3 h-2 rounded-sm"
              style={{ backgroundColor: s.color, opacity: 0.85 }}
            />
            {s.label}
          </div>
        ))}
        {hr5min && (
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded bg-red-500/50" />
            Heart rate
          </div>
        )}
      </div>
    </div>
  );
}
