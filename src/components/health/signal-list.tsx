import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/health/signals";
import { describeBaselineWindow } from "@/lib/analysis/baseline-window";

const GAUGE_RANGE = 3;

function gaugePosition(z: number): string {
  const clamped = Math.min(Math.max(z, -GAUGE_RANGE), GAUGE_RANGE);
  return `${((clamped + GAUGE_RANGE) / (2 * GAUGE_RANGE)) * 100}%`;
}

/**
 * Where the night sits against her usual range: the band is one standard
 * deviation either side of her baseline, the ticks are where the pattern
 * checks start calling a night unusual.
 */
export function SignalGauge({
  z,
  threshold,
  unusual,
}: {
  z: number | null;
  threshold: number;
  unusual: boolean;
}) {
  return (
    <div aria-hidden="true" className="relative h-4 w-full">
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      <div
        className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-corridor"
        style={{ left: gaugePosition(-1), right: gaugePosition(-1) }}
      />
      {[-threshold, threshold].map((tick) => (
        <div
          key={tick}
          className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-faint-foreground/60"
          style={{ left: gaugePosition(tick) }}
        />
      ))}
      {z != null && (
        <div
          className={cn(
            "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
            unusual ? "bg-attention" : "bg-foreground"
          )}
          style={{ left: gaugePosition(z) }}
        />
      )}
    </div>
  );
}

export function SignalList({
  signals,
  threshold,
}: {
  signals: Signal[];
  threshold: number;
}) {
  return (
    <div className="space-y-4">
      <ul className="divide-y divide-border">
        {signals.map((signal) => {
          const unusual = signal.level === "unusual";
          return (
            <li
              key={signal.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                {signal.label}
                {unusual && (
                  <span className="rounded-full bg-attention/12 px-2 py-0.5 text-xs font-medium text-attention ring-1 ring-inset ring-attention/25">
                    Unusual
                  </span>
                )}
              </p>
              <p className="text-right text-sm font-semibold tabular-nums">
                {signal.value}
              </p>
              <p
                className={cn(
                  "text-sm",
                  unusual ? "text-attention" : "text-muted-foreground"
                )}
              >
                {signal.comparison}
                {signal.usualValue && signal.comparison !== "About usual" && (
                  <span className="text-faint-foreground">
                    {" "}
                    · usual {signal.usualValue}
                  </span>
                )}
              </p>
              <div className="w-24 sm:w-32">
                <SignalGauge
                  z={signal.z}
                  threshold={threshold}
                  unusual={unusual}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <span className="relative mt-1 h-2 w-6 shrink-0" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-corridor" />
        </span>
        <span>
          Shaded: the usual range over {describeBaselineWindow()}. Ticks:
          where the pattern checks count a night as unusual.
        </span>
      </p>
    </div>
  );
}
