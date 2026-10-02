"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DayNavigator } from "@/components/ui/day-navigator";
import { cn } from "@/lib/utils";

interface CycleEntry {
  cycleNumber: number;
  thermalShiftDay: string | null;
  evidenceScore: number | null;
}

interface CycleCalendarProps {
  cycleData: CycleEntry[];
  currentDay: string;
}

interface ThermalShift {
  cycleNumber: number;
  day: string;
  evidenceScore: number | null;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function describeEvidence(score: number): string {
  if (score >= 0.7) return "Higher";
  if (score >= 0.4) return "Moderate";
  return "Limited";
}

function ShiftMarker({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2 shrink-0 rounded-full bg-foreground", className)}
    />
  );
}

export function CycleCalendar({
  cycleData,
  currentDay,
}: CycleCalendarProps) {
  const today = parseISO(currentDay);
  const [viewDate, setViewDate] = useState(today);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const shifts = useMemo(
    () =>
      cycleData
        .filter(
          (entry): entry is CycleEntry & { thermalShiftDay: string } =>
            entry.thermalShiftDay != null &&
            entry.thermalShiftDay <= currentDay
        )
        .map(
          (entry): ThermalShift => ({
            cycleNumber: entry.cycleNumber,
            day: entry.thermalShiftDay,
            evidenceScore: entry.evidenceScore,
          })
        )
        .sort((a, b) => a.day.localeCompare(b.day)),
    [cycleData, currentDay]
  );
  const shiftsByDay = useMemo(
    () => new Map(shifts.map((shift) => [shift.day, shift])),
    [shifts]
  );

  if (shifts.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            No detected thermal shifts are available yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const latestShift = shifts[shifts.length - 1];
  const earliestDate = parseISO(shifts[0].day);
  const isCurrentMonth = isSameMonth(viewDate, today);
  const canGoBack =
    startOfMonth(viewDate).getTime() > startOfMonth(earliestDate).getTime();
  const canGoForward =
    startOfMonth(viewDate).getTime() < startOfMonth(today).getTime();
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const selectedShift = selectedDay ? shiftsByDay.get(selectedDay) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detected Shift Dates</CardTitle>
        <CardDescription>
          {shifts.length} app-detected temperature shift
          {shifts.length === 1 ? "" : "s"} in the current evaluation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DayNavigator
          className="justify-between"
          label={
            <span className="flex items-center gap-2">
              {format(viewDate, "MMMM yyyy")}
              {!isCurrentMonth && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewDate(today)}
                >
                  Today
                </Button>
              )}
            </span>
          }
          onPrevious={() => setViewDate(subMonths(viewDate, 1))}
          onNext={() => setViewDate(addMonths(viewDate, 1))}
          previousDisabled={!canGoBack}
          nextDisabled={!canGoForward}
          previousLabel="Previous month"
          nextLabel="Next month"
        />

        {isCurrentMonth && (
          <p className="text-center text-sm font-medium">
            Latest detected thermal shift:{" "}
            {format(parseISO(latestShift.day), "MMM d")}
            {latestShift.evidenceScore != null
              ? ` · ${describeEvidence(latestShift.evidenceScore)} evidence`
              : ""}
          </p>
        )}

        <div className="-m-1 overflow-x-auto p-1">
          <div className="grid min-w-0 grid-cols-7 gap-1">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="py-1 text-center text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}

            {allDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const shift = shiftsByDay.get(key);
              const isAdjacent = !isSameMonth(day, viewDate);
              const isSelected = selectedDay === key;
              const isTodayCell = key === currentDay;

              if (isAdjacent) {
                return (
                  <div
                    key={key}
                    className="relative flex aspect-square flex-col items-center justify-center rounded-md p-1 opacity-30"
                  >
                    <span className="text-xs leading-none text-muted-foreground tabular-nums">
                      {format(day, "d")}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    shift && setSelectedDay(isSelected ? null : key)
                  }
                  disabled={!shift}
                  aria-pressed={shift ? isSelected : undefined}
                  aria-label={
                    shift
                      ? `Detected thermal shift on ${format(day, "MMMM d, yyyy")}`
                      : format(day, "MMMM d, yyyy")
                  }
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-md p-1 text-center transition-colors",
                    shift
                      ? "cursor-pointer border border-dashed border-muted-foreground/70 hover:bg-accent"
                      : "opacity-40",
                    isSelected && "ring-2 ring-primary",
                    !isSelected && isTodayCell && "ring-1 ring-muted-foreground/50"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs leading-none tabular-nums",
                      shift ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {shift && <ShiftMarker className="mt-1" />}
                </button>
              );
            })}
          </div>
        </div>

        {selectedShift && (
          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-medium">
                <ShiftMarker />
                Detected thermal shift
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {format(parseISO(selectedShift.day), "EEE, MMM d")}
              </span>
            </div>
            {selectedShift.evidenceScore != null && (
              <p className="text-xs text-muted-foreground">
                Evidence strength:{" "}
                {describeEvidence(selectedShift.evidenceScore)}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="flex size-3.5 items-center justify-center rounded-sm border border-dashed border-muted-foreground/70"
            >
              <ShiftMarker className="size-1.5" />
            </span>
            Detected thermal shift
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Temperature-pattern evidence only; this does not confirm ovulation,
          menstruation, or fertility.
        </p>
      </CardContent>
    </Card>
  );
}
