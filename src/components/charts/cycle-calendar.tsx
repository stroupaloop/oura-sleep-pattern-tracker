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
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
        <div className="flex items-center justify-between">
          <button
            onClick={() => setViewDate(subMonths(viewDate, 1))}
            disabled={!canGoBack}
            className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {format(viewDate, "MMMM yyyy")}
            </span>
            {!isCurrentMonth && (
              <button
                onClick={() => setViewDate(today)}
                className="text-xs px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 transition-colors text-muted-foreground"
              >
                Today
              </button>
            )}
          </div>
          <button
            onClick={() => setViewDate(addMonths(viewDate, 1))}
            disabled={!canGoForward}
            className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {isCurrentMonth && (
          <div className="text-sm font-medium text-center px-2 py-2 rounded-md bg-muted/50">
            Latest detected thermal shift:{" "}
            {format(parseISO(latestShift.day), "MMM d")}
            {latestShift.evidenceScore != null
              ? ` · ${describeEvidence(latestShift.evidenceScore)} evidence`
              : ""}
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-0">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-xs text-muted-foreground font-medium py-1"
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
                    className="relative aspect-square rounded-md p-1 flex flex-col items-center justify-center opacity-30"
                  >
                    <span className="text-[10px] text-muted-foreground leading-none">
                      {format(day, "d")}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={key}
                  onClick={() =>
                    shift && setSelectedDay(isSelected ? null : key)
                  }
                  disabled={!shift}
                  aria-label={
                    shift
                      ? `Detected thermal shift on ${format(day, "MMMM d, yyyy")}`
                      : format(day, "MMMM d, yyyy")
                  }
                  className={[
                    "relative aspect-square rounded-md p-1 text-center transition-all",
                    "flex flex-col items-center justify-center",
                    shift ? "bg-amber-500/15 cursor-pointer hover:ring-1 hover:ring-amber-400/50" : "opacity-40",
                    isSelected && "ring-2 ring-primary",
                    !isSelected && isTodayCell && "ring-1 ring-muted-foreground/50",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {format(day, "d")}
                  </span>
                  {shift && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedShift && (
          <div className="rounded-md border p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-amber-400">
                Detected thermal shift
              </span>
              <span className="text-xs text-muted-foreground">
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
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-amber-500/15 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
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
