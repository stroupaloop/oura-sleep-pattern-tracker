"use client";

import { useMemo, useRef, useState } from "react";
import { APP_TIME_ZONE } from "@/lib/date-utils";

interface HypnogramChartProps {
  hypnogram: string;
  hr5min: string | null;
  bedtimeStart: string;
}

const STAGES = [
  { key: 4, label: "Awake", color: "var(--stage-awake)", y: 0 },
  { key: 3, label: "REM", color: "var(--stage-rem)", y: 1 },
  { key: 2, label: "Light", color: "var(--stage-light)", y: 2 },
  { key: 1, label: "Deep", color: "var(--stage-deep)", y: 3 },
] as const;

const stageMap: Record<string, { label: string; value: number; color: string }> = {
  "1": { label: "Deep", value: 1, color: "var(--stage-deep)" },
  "2": { label: "Light", value: 2, color: "var(--stage-light)" },
  "3": { label: "REM", value: 3, color: "var(--stage-rem)" },
  "4": { label: "Awake", value: 4, color: "var(--stage-awake)" },
};

const LABEL_COLUMN_PX = 48;
const HEART_RATE_COLUMN_PX = 32;

/**
 * The 5-minute sample under a pointer `x` pixels into the chart, or null off
 * the bars. Bar `i` spans [i, i + 1) / count of the plot, which sits between
 * the stage labels and, when shown, the heart-rate axis.
 */
export function hypnogramIndexAt(
  x: number,
  width: number,
  count: number,
  hasHeartRateAxis: boolean
): number | null {
  const plotWidth =
    width - LABEL_COLUMN_PX - (hasHeartRateAxis ? HEART_RATE_COLUMN_PX : 0);
  if (plotWidth <= 0 || count <= 0) return null;
  const index = Math.floor(((x - LABEL_COLUMN_PX) / plotWidth) * count);
  return index >= 0 && index < count ? index : null;
}

/** Where sample `index` starts, as a share of the plot. */
export function hypnogramOffset(index: number, count: number): number {
  return count > 0 ? index / count : 0;
}

/**
 * Ticks on the whole ET hours the night crosses, every other hour past seven
 * hours, so the labels stay short enough not to collide on a phone.
 */
export function hourTicks(
  data: ReadonlyArray<Pick<DataPoint, "clock">>
): Array<{ share: number; label: string }> {
  const totalMinutes = data.length * 5;
  const step = totalMinutes > 7 * 60 ? 2 : 1;
  const ticks: Array<{ share: number; label: string }> = [];
  data.forEach((point, index) => {
    const previous = data[index - 1]?.clock;
    if (!point.clock || !previous || previous.hour === point.clock.hour) return;
    if (point.clock.hour % step !== 0) return;
    const minutes = index * 5 - point.clock.minute;
    const hour12 = point.clock.hour % 12 === 0 ? 12 : point.clock.hour % 12;
    ticks.push({
      share: minutes / totalMinutes,
      label: `${hour12} ${point.clock.hour < 12 ? "AM" : "PM"}`,
    });
  });
  return ticks;
}

const stageRow: Record<number, number> = { 4: 0, 3: 1, 2: 2, 1: 3 };

const ET_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

const ET_HOUR_MINUTE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

interface DataPoint {
  minuteOffset: number;
  time: string;
  /** ET hour and minute the sample starts at, or null without a start time. */
  clock: { hour: number; minute: number } | null;
  stage: number;
  stageLabel: string;
  hr: number | null;
  color: string;
}

interface StoredHeartRateSeries {
  timestamp: string;
  interval: number;
  items: Array<number | null>;
}

function parseStoredHeartRateSeries(
  value: string | null
): StoredHeartRateSeries | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { timestamp?: unknown }).timestamp !== "string" ||
      typeof (parsed as { interval?: unknown }).interval !== "number" ||
      !Array.isArray((parsed as { items?: unknown }).items)
    ) {
      return null;
    }
    const series = parsed as StoredHeartRateSeries;
    if (
      !Number.isFinite(series.interval) ||
      series.interval <= 0 ||
      series.items.some(
        (item) =>
          item !== null &&
          (typeof item !== "number" || !Number.isFinite(item))
      )
    ) {
      return null;
    }
    return series;
  } catch {
    return null;
  }
}

function parseHypnogram(
  hypnogram: string,
  hr5min: string | null,
  bedtimeStart: string
): DataPoint[] {
  const heartRateSeries = parseStoredHeartRateSeries(hr5min);
  const bedtimeTimestamp = /(?:Z|[+-]\d{2}:?\d{2})$/.test(bedtimeStart)
    ? Date.parse(bedtimeStart)
    : Number.NaN;
  const heartRateTimestamp = heartRateSeries
    ? /(?:Z|[+-]\d{2}:?\d{2})$/.test(heartRateSeries.timestamp)
      ? Date.parse(heartRateSeries.timestamp)
      : Number.NaN
    : Number.NaN;

  return Array.from(hypnogram).map((char, i) => {
    const info = stageMap[char] ?? { label: "Unknown", value: 2, color: "var(--muted-foreground)" };
    const phaseTimestamp = bedtimeTimestamp + i * 5 * 60 * 1000;
    const rawHeartRateIndex =
      heartRateSeries && Number.isFinite(phaseTimestamp) && Number.isFinite(heartRateTimestamp)
        ? (phaseTimestamp - heartRateTimestamp) /
          (heartRateSeries.interval * 1000)
        : Number.NaN;
    const heartRateIndex = Math.round(rawHeartRateIndex);
    const isAligned =
      heartRateSeries != null &&
      Number.isFinite(rawHeartRateIndex) &&
      Math.abs(rawHeartRateIndex - heartRateIndex) < 0.001 &&
      heartRateIndex >= 0 &&
      heartRateIndex < heartRateSeries.items.length;
    const clockParts = Number.isFinite(phaseTimestamp)
      ? ET_HOUR_MINUTE_FORMATTER.formatToParts(new Date(phaseTimestamp))
      : null;
    const clockPart = (type: "hour" | "minute") =>
      Number(clockParts?.find((part) => part.type === type)?.value);
    return {
      minuteOffset: i * 5,
      time:
        Number.isFinite(phaseTimestamp)
          ? ET_TIME_FORMATTER.format(new Date(phaseTimestamp))
          : "--",
      clock: clockParts
        ? { hour: clockPart("hour"), minute: clockPart("minute") }
        : null,
      stage: info.value,
      stageLabel: info.label,
      hr: isAligned
        ? heartRateSeries.items[heartRateIndex] ?? null
        : null,
      color: info.color,
    };
  });
}

export function HypnogramChart({ hypnogram, hr5min, bedtimeStart }: HypnogramChartProps) {
  const data = useMemo(
    () => parseHypnogram(hypnogram, hr5min, bedtimeStart),
    [hypnogram, hr5min, bedtimeStart]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    left: number;
    point: DataPoint;
  } | null>(null);

  if (data.length === 0) return null;

  const hrData = data.filter((d) => d.hr != null);
  const hasAlignedHeartRate = hrData.length > 1;
  const hrMin = hrData.length > 0 ? Math.min(...hrData.map((d) => d.hr!)) - 5 : 0;
  const hrMax = hrData.length > 0 ? Math.max(...hrData.map((d) => d.hr!)) + 5 : 100;
  const hrRange = hrMax - hrMin || 1;

  const rowHeight = 28;
  const rowGap = 2;
  const chartHeight = STAGES.length * rowHeight + (STAGES.length - 1) * rowGap;

  const timeTicks = hourTicks(data);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const index = hypnogramIndexAt(x, rect.width, data.length, hasAlignedHeartRate);
    if (index != null) {
      setTooltip({
        left: Math.max(0, Math.min(x, rect.width - 140)),
        point: data[index],
      });
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
            {STAGES.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-end text-xs text-muted-foreground"
                style={{ height: rowHeight }}
              >
                {s.label}
              </div>
            ))}
          </div>

          <div className="relative flex-1 rounded-md" style={{ overflow: "visible" }}>
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
                  key={d.minuteOffset}
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

            {hasAlignedHeartRate && (() => {
              const segments: Array<Array<{ x: number; y: number }>> = [];
              let segment: Array<{ x: number; y: number }> = [];
              data.forEach((point, index) => {
                if (point.hr == null) {
                  if (segment.length > 1) segments.push(segment);
                  segment = [];
                  return;
                }
                const x = hypnogramOffset(index + 0.5, data.length) * 100;
                const y = ((point.hr - hrMin) / hrRange) * 100;
                segment.push({ x, y: 100 - y });
              });
              if (segment.length > 1) segments.push(segment);
              return (
                <svg
                  className="absolute left-0 top-0 pointer-events-none"
                  style={{ width: "100%", height: chartHeight, zIndex: 10 }}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {segments.map((points, segmentIndex) => (
                    <path
                      key={segmentIndex}
                      d={points
                        .map(
                          (point, pointIndex) =>
                            `${pointIndex === 0 ? "M" : "L"} ${point.x} ${point.y}`
                        )
                        .join(" ")}
                      fill="none"
                      stroke="var(--series-hr)"
                      strokeWidth="2"
                      strokeOpacity="0.7"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              );
            })()}

            {tooltip && (
              <div
                className="absolute top-0 bottom-0 w-px bg-foreground/30 pointer-events-none"
                style={{
                  left: `${hypnogramOffset(data.indexOf(tooltip.point) + 0.5, data.length) * 100}%`,
                }}
              />
            )}
          </div>

          {hasAlignedHeartRate && (
            <div className="flex flex-col justify-between shrink-0 w-8 pl-1 text-[11px] text-muted-foreground tabular-nums">
              <span>{Math.round(hrMax)}</span>
              <span>bpm</span>
              <span>{Math.round(hrMin)}</span>
            </div>
          )}
        </div>

        <div className={`flex pl-12 mt-1 ${hasAlignedHeartRate ? "pr-8" : ""}`}>
          <div className="relative h-4 flex-1 text-[11px] text-muted-foreground tabular-nums">
            {timeTicks.map(({ share, label }) => (
              <span
                key={label}
                className={`absolute whitespace-nowrap ${share > 0.92 ? "-translate-x-full" : share > 0.04 ? "-translate-x-1/2" : ""}`}
                style={{ left: `${share * 100}%` }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {tooltip && (
          <div
            className="absolute z-10 rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md pointer-events-none"
            style={{
              left: tooltip.left,
              top: -50,
            }}
          >
            <p className="font-medium tabular-nums">{tooltip.point.time}</p>
            <p className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: tooltip.point.color }}
              />
              {tooltip.point.stageLabel}
            </p>
            {tooltip.point.hr != null && (
              <p className="text-muted-foreground">{tooltip.point.hr} bpm</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-center text-xs text-muted-foreground mt-2">
        {STAGES.map((s) => (
          <div key={s.key} className="flex items-center gap-1">
            <span
              className="w-3 h-2 rounded-sm"
              style={{ backgroundColor: s.color, opacity: 0.85 }}
            />
            {s.label}
          </div>
        ))}
        {hasAlignedHeartRate && (
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 rounded bg-series-hr" />
            Heart rate
          </div>
        )}
      </div>
    </div>
  );
}
