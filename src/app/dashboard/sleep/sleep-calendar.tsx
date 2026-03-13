"use client";

import { useState } from "react";
import { getTodayET } from "@/lib/date-utils";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  subWeeks,
  format,
  isSameDay,
  isAfter,
  isToday,
} from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { NightCardContent, type NightData, type AnalysisData } from "./night-card";

function getScoreColor(score: number): string {
  if (score < 60) return "#ef4444";
  if (score < 75) return "#f59e0b";
  if (score < 85) return "#22c55e";
  return "#4ade80";
}

function getScoreBg(score: number): string {
  if (score < 60) return "bg-red-500/10";
  if (score < 75) return "bg-amber-500/10";
  if (score < 85) return "bg-green-500/10";
  return "bg-emerald-500/10";
}

interface SleepCalendarProps {
  nights: Record<string, NightData>;
  scores: Record<string, number>;
  analyses: Record<string, AnalysisData>;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function SleepCalendar({ nights, scores, analyses }: SleepCalendarProps) {
  const today = new Date(getTodayET() + "T12:00:00");
  const gridStart = startOfWeek(subWeeks(today, 4), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(today, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  const mostRecentWithData = allDays
    .filter((d) => nights[format(d, "yyyy-MM-dd")])
    .at(-1);
  const initialDay = mostRecentWithData
    ? format(mostRecentWithData, "yyyy-MM-dd")
    : format(today, "yyyy-MM-dd");

  const [selectedDay, setSelectedDay] = useState<string>(initialDay);

  const selectedNight = nights[selectedDay];
  const selectedScore = scores[selectedDay] ?? null;
  const selectedAnalysis = analyses[selectedDay];

  return (
    <div className="space-y-4">
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
              const score = scores[key];
              const night = nights[key];
              const analysis = analyses[key];
              const isFuture = isAfter(day, today);
              const isSelected = selectedDay === key;
              const isTodayCell = isToday(day);
              const hasData = !!night;

              const total = night?.totalSleepDuration ?? 0;
              const deep = night?.deepSleepDuration ?? 0;
              const rem = night?.remSleepDuration ?? 0;
              const light = night?.lightSleepDuration ?? 0;
              const deepPct = total > 0 ? (deep / total) * 100 : 0;
              const remPct = total > 0 ? (rem / total) * 100 : 0;
              const lightPct = total > 0 ? (light / total) * 100 : 0;

              return (
                <button
                  key={key}
                  disabled={isFuture}
                  onClick={() => setSelectedDay(key)}
                  className={[
                    "relative aspect-square md:aspect-auto md:h-20 rounded-md p-1 md:p-2 text-left transition-all",
                    "flex flex-col items-center md:items-start justify-center md:justify-between",
                    isFuture && "opacity-30 cursor-not-allowed",
                    !isFuture && !hasData && "opacity-50",
                    !isFuture && "cursor-pointer hover:ring-1 hover:ring-muted-foreground/40",
                    hasData && score != null && getScoreBg(score),
                    isSelected && "ring-2 ring-primary",
                    !isSelected && isTodayCell && "ring-1 ring-muted-foreground/30",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="text-[10px] md:text-xs text-muted-foreground self-start leading-none">
                    {format(day, "d")}
                  </span>

                  {score != null && (
                    <span
                      className="text-sm md:text-lg font-bold leading-none"
                      style={{ color: getScoreColor(score) }}
                    >
                      {score}
                    </span>
                  )}

                  {analysis?.isAnomaly && (
                    <span
                      className={[
                        "absolute top-1 right-1 w-1.5 h-1.5 rounded-full",
                        analysis.anomalyDirection === "hyper"
                          ? "bg-amber-400"
                          : "bg-blue-400",
                      ].join(" ")}
                    />
                  )}

                  {hasData && total > 0 && (
                    <div className="hidden md:flex w-full h-[3px] rounded-full overflow-hidden mt-auto">
                      <div
                        className="bg-indigo-500"
                        style={{ width: `${deepPct}%` }}
                      />
                      <div
                        className="bg-cyan-400"
                        style={{ width: `${remPct}%` }}
                      />
                      <div
                        className="bg-slate-400"
                        style={{ width: `${lightPct}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {selectedNight ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{selectedDay}</h3>
                {selectedScore != null && (
                  <span
                    className="text-lg font-bold"
                    style={{ color: getScoreColor(selectedScore) }}
                  >
                    Score: {selectedScore}
                  </span>
                )}
              </div>
              <NightCardContent
                night={selectedNight}
                score={selectedScore}
                analysis={selectedAnalysis}
              />
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="font-medium">{selectedDay}</p>
              <p className="text-sm mt-1">No sleep data for this day</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
