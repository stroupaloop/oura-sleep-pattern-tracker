"use client";

import { cn } from "@/lib/utils";
import {
  MOOD_SCALE,
  formatMoodValue,
  moodSwatchClass,
} from "@/lib/design/mood-scale";

/**
 * The -3 to +3 mood scale as seven buttons: the signed value on a neutral
 * button, rose when chosen, with the scale's lightness ramp as a thin bar
 * beneath, never behind the number.
 */
export function MoodScalePicker({
  value,
  onSelect,
  disabled,
  size = "md",
  dense = false,
  className,
}: {
  value: number | null;
  onSelect: (value: number) => void;
  disabled?: boolean;
  /** md is 40px tall, lg 48px. */
  size?: "md" | "lg";
  /** Tightens md to 36px from sm. */
  dense?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-7 gap-1 sm:gap-1.5", className)}
      role="group"
      aria-label="Personal mood score"
    >
      {MOOD_SCALE.map((mood) => {
        const isSelected = value === mood.value;
        return (
          <div key={mood.value} className="flex min-w-0 flex-col gap-1">
            <button
              type="button"
              onClick={() => onSelect(mood.value)}
              disabled={disabled}
              aria-label={`${formatMoodValue(mood.value)}: ${mood.label}`}
              aria-pressed={isSelected}
              className={cn(
                "flex w-full items-center justify-center rounded-md border text-sm font-medium tabular-nums transition-colors",
                "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                "disabled:cursor-not-allowed disabled:opacity-50",
                size === "lg" ? "h-12" : "h-10",
                size === "md" && dense && "sm:h-9",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {formatMoodValue(mood.value)}
            </button>
            <span
              aria-hidden="true"
              className={cn("h-[3px] rounded-full", moodSwatchClass(mood.value))}
            />
          </div>
        );
      })}
    </div>
  );
}
