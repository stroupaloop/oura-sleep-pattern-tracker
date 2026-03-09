"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface BedtimePoint {
  day: string;
  actualBedtime: number | null;
  optimalStart: number | null;
  optimalEnd: number | null;
}

interface BedtimeTrendChartProps {
  data: BedtimePoint[];
  days?: number;
}

function formatMinutesAsTime(minutes: number): string {
  const adjusted = minutes < 0 ? minutes + 1440 : minutes;
  const h = Math.floor(adjusted / 60) % 24;
  const m = adjusted % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getDotColor(actual: number, optStart: number, optEnd: number): string {
  if (actual >= optStart && actual <= optEnd) return "bg-green-400";
  const diff = actual < optStart
    ? optStart - actual
    : actual - optEnd;
  if (diff <= 30) return "bg-amber-400";
  return "bg-red-400";
}

function getDotLabel(actual: number, optStart: number, optEnd: number): string {
  if (actual >= optStart && actual <= optEnd) return "On time";
  const diff = actual < optStart
    ? optStart - actual
    : actual - optEnd;
  if (diff <= 30) return "Slightly off";
  return "Way off";
}

export function BedtimeTrendChart({
  data,
  days = 30,
}: BedtimeTrendChartProps) {
  const sliced = data.slice(-days).filter((d) => d.actualBedtime != null);

  if (sliced.length === 0) return null;

  const hasAnyOptimal = sliced.some((d) => d.optimalStart != null && d.optimalEnd != null);

  const allMinutes = sliced.flatMap((d) => [
    d.actualBedtime!,
    ...(d.optimalStart != null ? [d.optimalStart] : []),
    ...(d.optimalEnd != null ? [d.optimalEnd] : []),
  ]);
  const rangeMin = Math.min(...allMinutes) - 30;
  const rangeMax = Math.max(...allMinutes) + 30;
  const rangeSpan = rangeMax - rangeMin;

  const tickCount = 5;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(Math.round(rangeMin + (rangeSpan / tickCount) * i));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sleep Timing</CardTitle>
        <CardDescription>
          {hasAnyOptimal
            ? `Bedtime vs. optimal window (last ${days} days)`
            : `Bedtime trend (last ${days} days — optimal window not available from Oura)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-2 pl-14">
            {ticks.map((t) => (
              <span key={t}>{formatMinutesAsTime(t)}</span>
            ))}
          </div>

          <div className="space-y-0.5">
            {sliced.reverse().map((point) => {
              const actual = point.actualBedtime!;
              const hasOptimal = point.optimalStart != null && point.optimalEnd != null;
              const dotLeft = ((actual - rangeMin) / rangeSpan) * 100;

              if (!hasOptimal) {
                const dotClass = hasAnyOptimal
                  ? "bg-muted-foreground/40"
                  : "bg-primary/60";
                const dotTitle = hasAnyOptimal
                  ? `${formatMinutesAsTime(actual)} — No data`
                  : formatMinutesAsTime(actual);
                return (
                  <div key={point.day} className="flex items-center gap-2 group">
                    <span className="text-[10px] text-muted-foreground w-12 shrink-0 text-right">
                      {point.day.slice(5)}
                    </span>
                    <div className="relative flex-1 h-5">
                      <div className="absolute inset-y-0 left-0 right-0 bg-muted/30 rounded-sm" />
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${dotClass} transition-transform group-hover:scale-150`}
                        style={{ left: `${Math.max(0, Math.min(98, dotLeft))}%` }}
                        title={dotTitle}
                      />
                    </div>
                  </div>
                );
              }

              const optStart = point.optimalStart!;
              const optEnd = point.optimalEnd!;
              const windowLeft = ((optStart - rangeMin) / rangeSpan) * 100;
              const windowWidth = ((optEnd - optStart) / rangeSpan) * 100;
              const dotColor = getDotColor(actual, optStart, optEnd);
              const label = getDotLabel(actual, optStart, optEnd);

              return (
                <div
                  key={point.day}
                  className="flex items-center gap-2 group"
                >
                  <span className="text-[10px] text-muted-foreground w-12 shrink-0 text-right">
                    {point.day.slice(5)}
                  </span>
                  <div className="relative flex-1 h-5">
                    <div className="absolute inset-y-0 left-0 right-0 bg-muted/30 rounded-sm" />
                    <div
                      className="absolute inset-y-0 bg-violet-500/15 rounded-sm"
                      style={{
                        left: `${Math.max(0, windowLeft)}%`,
                        width: `${Math.min(100 - windowLeft, windowWidth)}%`,
                      }}
                    />
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${dotColor} transition-transform group-hover:scale-150`}
                      style={{ left: `${Math.max(0, Math.min(98, dotLeft))}%` }}
                      title={`${formatMinutesAsTime(actual)} — ${label}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 justify-center mt-4 text-[10px] text-muted-foreground">
            {hasAnyOptimal ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-violet-500/15" />
                  Optimal window
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  On time
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  Slightly off
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  Way off
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
                  No data
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-primary/60" />
                Actual bedtime
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
