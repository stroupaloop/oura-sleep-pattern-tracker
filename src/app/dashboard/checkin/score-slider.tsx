"use client";

import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A 1-5 answer that can be left unanswered. A range input always has a
 * position, so an unset one rests at 3 in a muted tone and reads "Not set".
 * Moving it answers it, and so does a tap where it rests, which fires no
 * change event. That tap is read from the pointer, not from click, because
 * tapping the label also clicks the slider. Clear puts it back to unanswered.
 */
export function ScoreSlider({
  label,
  low,
  high,
  value,
  onChange,
  disabled,
}: {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const answered = value !== null;

  return (
    <div>
      <div className="flex min-h-10 items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-sm tabular-nums",
              !answered && "text-muted-foreground"
            )}
          >
            {answered ? `${value}/5` : "Not set"}
          </span>
          {answered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              aria-label={`Clear ${label.toLowerCase()}`}
              onClick={() => {
                onChange(null);
                input.current?.focus();
              }}
              className="-mr-3 text-muted-foreground"
            >
              Clear
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-xs text-muted-foreground">
          {low}
        </span>
        <input
          ref={input}
          id={id}
          type="range"
          min={1}
          max={5}
          step={1}
          value={value ?? 3}
          disabled={disabled}
          aria-valuetext={answered ? `${value} of 5` : "Not set"}
          onChange={(event) => onChange(Number(event.target.value))}
          onPointerUp={(event) => {
            if (!answered && event.button === 0) {
              onChange(Number(event.currentTarget.value));
            }
          }}
          className={cn(
            "h-10 min-w-0 flex-1 sm:h-8",
            answered ? "accent-primary" : "accent-muted-foreground"
          )}
        />
        <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
          {high}
        </span>
      </div>
    </div>
  );
}
