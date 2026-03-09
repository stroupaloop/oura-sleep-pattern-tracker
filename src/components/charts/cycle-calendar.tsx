"use client";

import { useState, useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addDays,
  addMonths,
  subMonths,
  differenceInDays,
  isAfter,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MENSTRUAL_DAYS = 5;

type Phase = "menstrual" | "follicular" | "fertile" | "ovulation" | "luteal";

interface CycleEntry {
  cycleNumber: number;
  periodStartDay: string | null;
  ovulationDay: string | null;
  nextPeriodDay: string | null;
  cycleLength: number | null;
  confidence: number | null;
}

interface CycleCalendarProps {
  cycleData: CycleEntry[];
}

interface DayPhase {
  phase: Phase;
  dayInPhase: number;
  totalPhaseDays: number;
  estimated: boolean;
  confidence: number | null;
}

const PHASE_CONFIG: Record<Phase, { label: string; bg: string; text: string }> = {
  menstrual: { label: "Menstrual", bg: "bg-red-500/15", text: "text-red-400" },
  follicular: { label: "Follicular", bg: "bg-blue-500/15", text: "text-blue-400" },
  fertile: { label: "Fertile", bg: "bg-green-500/15", text: "text-green-400" },
  ovulation: { label: "Ovulation", bg: "bg-amber-500/15", text: "text-amber-400" },
  luteal: { label: "Luteal", bg: "bg-pink-500/15", text: "text-pink-400" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildPhaseMap(cycleData: CycleEntry[]): Map<string, DayPhase> {
  const map = new Map<string, DayPhase>();
  const today = new Date();
  const sorted = [...cycleData]
    .filter((c) => c.periodStartDay)
    .sort((a, b) => a.periodStartDay!.localeCompare(b.periodStartDay!));

  for (let i = 0; i < sorted.length; i++) {
    const cycle = sorted[i];
    const periodStart = parseISO(cycle.periodStartDay!);
    const ovulation = cycle.ovulationDay ? parseISO(cycle.ovulationDay) : null;
    const nextPeriod = cycle.nextPeriodDay
      ? parseISO(cycle.nextPeriodDay)
      : sorted[i + 1]?.periodStartDay
        ? parseISO(sorted[i + 1].periodStartDay!)
        : null;

    const menstrualEnd = addDays(periodStart, MENSTRUAL_DAYS - 1);
    for (let d = 0; d < MENSTRUAL_DAYS; d++) {
      const day = addDays(periodStart, d);
      const key = format(day, "yyyy-MM-dd");
      map.set(key, {
        phase: "menstrual",
        dayInPhase: d + 1,
        totalPhaseDays: MENSTRUAL_DAYS,
        estimated: isAfter(day, today),
        confidence: cycle.confidence,
      });
    }

    if (ovulation) {
      const fertileStart = addDays(ovulation, -5);
      const fertileEnd = addDays(ovulation, -1);
      const follicularStart = addDays(menstrualEnd, 1);
      const follicularEnd = addDays(fertileStart, -1);
      const follicularDays = Math.max(0, differenceInDays(follicularEnd, follicularStart) + 1);

      if (follicularDays > 0) {
        for (let d = 0; d < follicularDays; d++) {
          const day = addDays(follicularStart, d);
          const key = format(day, "yyyy-MM-dd");
          map.set(key, {
            phase: "follicular",
            dayInPhase: d + 1,
            totalPhaseDays: follicularDays,
            estimated: isAfter(day, today),
            confidence: cycle.confidence,
          });
        }
      }

      for (let d = 0; d < 5; d++) {
        const day = addDays(fertileStart, d);
        const key = format(day, "yyyy-MM-dd");
        map.set(key, {
          phase: "fertile",
          dayInPhase: d + 1,
          totalPhaseDays: 5,
          estimated: isAfter(day, today),
          confidence: cycle.confidence,
        });
      }

      const ovKey = format(ovulation, "yyyy-MM-dd");
      map.set(ovKey, {
        phase: "ovulation",
        dayInPhase: 1,
        totalPhaseDays: 1,
        estimated: isAfter(ovulation, today),
        confidence: cycle.confidence,
      });

      if (nextPeriod) {
        const lutealStart = addDays(ovulation, 1);
        const lutealEnd = addDays(nextPeriod, -1);
        const lutealDays = Math.max(0, differenceInDays(lutealEnd, lutealStart) + 1);

        for (let d = 0; d < lutealDays; d++) {
          const day = addDays(lutealStart, d);
          const key = format(day, "yyyy-MM-dd");
          map.set(key, {
            phase: "luteal",
            dayInPhase: d + 1,
            totalPhaseDays: lutealDays,
            estimated: isAfter(day, today),
            confidence: cycle.confidence,
          });
        }
      }
    } else {
      const afterMenstrual = addDays(menstrualEnd, 1);
      const endDay = nextPeriod ? addDays(nextPeriod, -1) : addDays(periodStart, 27);
      const days = Math.max(0, differenceInDays(endDay, afterMenstrual) + 1);

      for (let d = 0; d < days; d++) {
        const day = addDays(afterMenstrual, d);
        const key = format(day, "yyyy-MM-dd");
        map.set(key, {
          phase: "follicular",
          dayInPhase: d + 1,
          totalPhaseDays: days,
          estimated: true,
          confidence: cycle.confidence,
        });
      }
    }
  }

  return map;
}

function getTodayBanner(phaseMap: Map<string, DayPhase>, cycleData: CycleEntry[]): string | null {
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todayPhase = phaseMap.get(todayKey);
  if (!todayPhase) return null;

  const config = PHASE_CONFIG[todayPhase.phase];
  let banner = `Day ${todayPhase.dayInPhase} of ${config.label.toLowerCase()} phase`;

  const today = new Date();
  const futurePeriods = cycleData
    .filter((c) => c.periodStartDay && isAfter(parseISO(c.periodStartDay), today))
    .sort((a, b) => a.periodStartDay!.localeCompare(b.periodStartDay!));

  if (futurePeriods.length > 0) {
    banner += ` · Next period ~${format(parseISO(futurePeriods[0].periodStartDay!), "MMM d")}`;
  }

  return banner;
}

function getNextEvent(phaseMap: Map<string, DayPhase>, dayKey: string): string | null {
  const day = parseISO(dayKey);
  const currentPhase = phaseMap.get(dayKey);
  if (!currentPhase) return null;

  for (let d = 1; d <= 40; d++) {
    const checkDay = addDays(day, d);
    const checkKey = format(checkDay, "yyyy-MM-dd");
    const checkPhase = phaseMap.get(checkKey);
    if (checkPhase && checkPhase.phase !== currentPhase.phase) {
      return `${PHASE_CONFIG[checkPhase.phase].label} in ${d} day${d === 1 ? "" : "s"}`;
    }
  }
  return null;
}

export function CycleCalendar({ cycleData }: CycleCalendarProps) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(today);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const phaseMap = useMemo(() => buildPhaseMap(cycleData), [cycleData]);
  const banner = useMemo(() => getTodayBanner(phaseMap, cycleData), [phaseMap, cycleData]);

  const isCurrentMonth = isSameMonth(viewDate, today);

  const earliestDate = useMemo(() => {
    const starts = cycleData
      .map((c) => c.periodStartDay)
      .filter((d): d is string => d != null);
    if (starts.length === 0) return null;
    return parseISO(starts.reduce((a, b) => (a < b ? a : b)));
  }, [cycleData]);

  const latestDate = useMemo(() => {
    const allDays = cycleData.flatMap((c) => [c.periodStartDay, c.ovulationDay, c.nextPeriodDay]);
    const valid = allDays.filter((d): d is string => d != null);
    if (valid.length === 0) return null;
    return parseISO(valid.reduce((a, b) => (a > b ? a : b)));
  }, [cycleData]);

  const canGoForward = latestDate
    ? startOfMonth(viewDate) < startOfMonth(latestDate)
    : false;

  const canGoBack = earliestDate
    ? startOfMonth(viewDate) > startOfMonth(earliestDate)
    : false;

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  if (cycleData.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">No cycle data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  const selectedPhase = selectedDay ? phaseMap.get(selectedDay) : null;
  const nextEvent = selectedDay ? getNextEvent(phaseMap, selectedDay) : null;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
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

        {isCurrentMonth && banner && (
          <div className="text-sm font-medium text-center px-2 py-2 rounded-md bg-muted/50">
            {banner}
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

            {weeks.map((week) =>
              week.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const phase = phaseMap.get(key);
                const isAdjacent = !isSameMonth(day, viewDate);
                const isSelected = selectedDay === key;
                const isTodayCell = isToday(day);

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
                    onClick={() => setSelectedDay(isSelected ? null : key)}
                    className={[
                      "relative aspect-square rounded-md p-1 text-center transition-all",
                      "flex flex-col items-center justify-center",
                      phase ? PHASE_CONFIG[phase.phase].bg : "",
                      phase?.estimated && "border border-dashed border-muted-foreground/30 opacity-60",
                      !phase && "opacity-40",
                      "cursor-pointer hover:ring-1 hover:ring-muted-foreground/40",
                      isSelected && "ring-2 ring-primary",
                      !isSelected && isTodayCell && "ring-1 ring-muted-foreground/50",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="text-[10px] text-muted-foreground leading-none">
                      {format(day, "d")}
                    </span>
                    {phase?.phase === "ovulation" && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 mt-0.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selectedDay && selectedPhase && (
          <div className="rounded-md border p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className={`font-medium ${PHASE_CONFIG[selectedPhase.phase].text}`}>
                {PHASE_CONFIG[selectedPhase.phase].label}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(parseISO(selectedDay), "EEE, MMM d")}
              </span>
            </div>
            <p className="text-muted-foreground">
              Day {selectedPhase.dayInPhase} of {selectedPhase.totalPhaseDays}
            </p>
            {nextEvent && (
              <p className="text-muted-foreground">{nextEvent}</p>
            )}
            {selectedPhase.confidence != null && (
              <p className="text-xs text-muted-foreground">
                Confidence: {Math.round(selectedPhase.confidence * 100)}%
              </p>
            )}
            {selectedPhase.phase === "fertile" && (
              <p className="text-xs text-amber-400/80">High fertility window</p>
            )}
            {selectedPhase.phase === "ovulation" && (
              <p className="text-xs text-amber-400/80">Peak fertility</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center text-[10px] text-muted-foreground">
          {(["menstrual", "follicular", "fertile", "ovulation", "luteal"] as Phase[]).map((p) => (
            <div key={p} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded-sm ${PHASE_CONFIG[p].bg} ${p === "ovulation" ? "flex items-center justify-center" : ""}`}>
                {p === "ovulation" && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
              </span>
              {PHASE_CONFIG[p].label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
