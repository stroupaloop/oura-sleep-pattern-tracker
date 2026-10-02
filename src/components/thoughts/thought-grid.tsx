"use client";

import { useState } from "react";
import { formatIsoDay } from "@/lib/date-utils";
import type { GridModel } from "@/lib/thoughts-stats";
import { cn } from "@/lib/utils";

const RAMP = [
  "var(--thought-empty)",
  "var(--thought-1)",
  "var(--thought-2)",
  "var(--thought-3)",
  "var(--thought-4)",
  "var(--thought-5)",
];

const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function monthLabel(day: string): string | null {
  const date = new Date(`${day}T12:00:00Z`);
  if (date.getUTCDate() > 7) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function describeCell(day: string, count: number): string {
  const when = formatIsoDay(day) ?? day;
  if (count === 0) return `No thoughts on ${when}`;
  return `${count} ${count === 1 ? "thought" : "thoughts"} on ${when}`;
}

export function ThoughtGrid({ grid }: { grid: GridModel }) {
  const [hovered, setHovered] = useState<{
    day: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex gap-[3px] pl-8 pt-5 relative">
            {/* Weekday gutter */}
            <div className="absolute left-0 top-5 flex flex-col gap-[3px]">
              {WEEKDAY_LABELS.map((label, index) => (
                <div
                  key={index}
                  className="h-[11px] text-[11px] leading-[11px] text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            {grid.weeks.map((week, weekIndex) => {
              const first = week.days[0];
              const label = first ? monthLabel(first.day) : null;
              return (
                <div key={weekIndex} className="flex flex-col gap-[3px] relative">
                  {label && (
                    <span className="absolute -top-5 left-0 whitespace-nowrap text-[11px] text-muted-foreground">
                      {label}
                    </span>
                  )}
                  {week.days.map((cell, dayIndex) => {
                    if (!cell || cell.future) {
                      return (
                        <div
                          key={dayIndex}
                          className="h-[11px] w-[11px] rounded-[2px] opacity-0"
                          aria-hidden
                        />
                      );
                    }
                    return (
                      <div
                        key={dayIndex}
                        role="img"
                        aria-label={describeCell(cell.day, cell.count)}
                        title={describeCell(cell.day, cell.count)}
                        className={cn(
                          "h-[11px] w-[11px] rounded-[2px]",
                          cell.count > 0 && "hover:ring-1 hover:ring-foreground/70"
                        )}
                        style={{ background: RAMP[cell.bucket] }}
                        onMouseEnter={(event) => {
                          const rect =
                            event.currentTarget.getBoundingClientRect();
                          setHovered({
                            day: cell.day,
                            count: cell.count,
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          });
                        }}
                        onMouseLeave={() => setHovered(null)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {hovered && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap shadow-md"
            style={{ left: hovered.x, top: hovered.y - 6 }}
          >
            {describeCell(hovered.day, hovered.count)}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-4 pl-8 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-[3px]">
          Less
          {RAMP.map((color, index) => (
            <span
              key={index}
              className="ml-[1px] h-[11px] w-[11px] rounded-[2px]"
              style={{ background: color }}
            />
          ))}
          <span className="ml-1">More</span>
        </span>
      </div>

      {/* Non-visual equivalent so the data is never colour-only. */}
      <table className="sr-only">
        <caption>Thoughts per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Thoughts</th>
          </tr>
        </thead>
        <tbody>
          {grid.weeks
            .flatMap((week) => week.days)
            .filter((cell) => cell && !cell.future && cell.count > 0)
            .map((cell) => (
              <tr key={cell!.day}>
                <th scope="row">{formatIsoDay(cell!.day) ?? cell!.day}</th>
                <td>{cell!.count}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
