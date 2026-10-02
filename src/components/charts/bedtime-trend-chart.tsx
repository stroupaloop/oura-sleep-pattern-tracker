"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/health/signals";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

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
  const adjusted = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(adjusted / 60);
  const m = adjusted % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

/**
 * Where the bedtime fell against Oura's suggested window, in words. The window
 * is Oura's suggestion, not her usual, so it is described and never graded.
 */
function describeWindow(actual: number, start: number, end: number): string {
  if (actual >= start && actual <= end) return "Inside Oura's suggested window";
  const gap = actual < start ? start - actual : actual - end;
  return `Outside Oura's suggested window by ${formatMinutes(gap)}`;
}

export function BedtimeTrendChart({
  data,
  days = 30,
}: BedtimeTrendChartProps) {
  const sliced = data.slice(-days).filter((d) => d.actualBedtime != null);

  if (sliced.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sleep Timing</CardTitle>
          <CardDescription>
            Oura-detected bedtime in ET (last {days} recorded nights)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No Oura-detected bedtime is available for this range."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/settings">Review sync settings</Link>
              </Button>
            }
          >
            If recent sleep is missing, open Oura to finish the ring sync, then
            sync this app again.
          </EmptyState>
        </CardContent>
      </Card>
    );
  }

  const hasWindow = (d: BedtimePoint) =>
    d.optimalStart != null && d.optimalEnd != null;
  const hasAnyWindow = sliced.some(hasWindow);
  const hasMissingWindow = hasAnyWindow && sliced.some((d) => !hasWindow(d));

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
          {hasAnyWindow
            ? `Oura-detected bedtime vs. Oura's suggested window in ET (last ${days} recorded nights)`
            : `Oura-detected bedtime in ET (last ${days} recorded nights — Oura's suggested window not available for display)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="flex justify-between text-xs text-muted-foreground tabular-nums mb-2 pl-14">
            {ticks.map((t) => (
              <span key={t}>{formatMinutesAsTime(t)}</span>
            ))}
          </div>

          <div className="space-y-0.5">
            {[...sliced].reverse().map((point) => {
              const actual = point.actualBedtime!;
              const time = formatMinutesAsTime(actual);
              const dotLeft = ((actual - rangeMin) / rangeSpan) * 100;
              const windowed = hasWindow(point);
              const words = windowed
                ? describeWindow(actual, point.optimalStart!, point.optimalEnd!)
                : "Oura's suggested window unavailable";
              const windowLeft = windowed
                ? ((point.optimalStart! - rangeMin) / rangeSpan) * 100
                : 0;
              const windowWidth = windowed
                ? ((point.optimalEnd! - point.optimalStart!) / rangeSpan) * 100
                : 0;

              return (
                <div key={point.day} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums w-12 shrink-0 text-right">
                    {point.day.slice(5)}
                  </span>
                  <div className="relative flex-1 h-5">
                    <div className="absolute inset-y-0 left-0 right-0 bg-muted/30 rounded-sm" />
                    {windowed && (
                      <div
                        className="absolute inset-y-0 rounded-sm bg-corridor ring-1 ring-inset ring-border"
                        style={{
                          left: `${Math.max(0, windowLeft)}%`,
                          width: `${Math.min(100 - windowLeft, windowWidth)}%`,
                        }}
                      />
                    )}
                    <div
                      role="img"
                      aria-label={`${point.day}: Oura-detected bedtime ${time}; ${words}`}
                      title={windowed || hasAnyWindow ? `${time} — ${words}` : time}
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 size-2.5 rounded-full ring-2 ring-card",
                        windowed || !hasAnyWindow
                          ? "bg-foreground"
                          : "bg-muted-foreground"
                      )}
                      style={{ left: `${Math.max(0, Math.min(98, dotLeft))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {hasAnyWindow && (
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-3 w-4 rounded-sm bg-corridor ring-1 ring-inset ring-border"
                />
                Oura&apos;s suggested window
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full bg-foreground"
              />
              Oura-detected bedtime
            </div>
            {hasMissingWindow && (
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-muted-foreground"
                />
                Suggested window unavailable
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
