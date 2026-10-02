"use client";

import { useState } from "react";
import { getTodayET } from "@/lib/date-utils";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  subWeeks,
  format,
  isAfter,
} from "date-fns";
import { cn } from "@/lib/utils";
import { scoreBand } from "@/lib/design/score-bands";
import { describePatternDirection } from "@/lib/design/pattern-direction";
import { formatNightLabel } from "@/lib/health/format";
import { STAGE_STYLES } from "@/components/health/night-window-chart";
import { PatternDirectionLabel } from "@/components/pattern-direction-label";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { NightCardContent, type NightData, type AnalysisData } from "./night-card";

interface SleepCalendarProps {
  nights: Record<string, NightData>;
  scores: Record<string, number>;
  analyses: Record<string, AnalysisData>;
  /** The pattern checks' daily threshold, in standard deviations. */
  threshold: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type FlagKind = "up" | "down" | "unclear";

const FLAG_LABELS: Record<FlagKind, string> = {
  up: "Higher-activation flag",
  down: "Lower-activation flag",
  unclear: "Flag with no clear direction",
};

function flagKind(analysis: AnalysisData | undefined): FlagKind | null {
  if (!analysis?.isAnomaly) return null;
  const { arrow } = describePatternDirection(analysis.anomalyDirection);
  return arrow ?? "unclear";
}

/**
 * A flagged night is marked in the attention color; its direction is a
 * shape and words, never a second color.
 */
function FlagMarker({ kind }: { kind: FlagKind }) {
  if (kind === "unclear") {
    return (
      <span aria-hidden="true" className="block size-2 rounded-full bg-attention" />
    );
  }
  return (
    <span aria-hidden="true" className="block text-xs leading-none text-attention">
      {kind === "up" ? "▲" : "▼"}
    </span>
  );
}

function ScoreMeta({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <span className="text-sm">
      Score:{" "}
      <span className="font-semibold text-foreground">{score}</span>{" "}
      <span className={cn("font-medium", band.text)}>{band.label}</span>
    </span>
  );
}

export function SleepCalendar({
  nights,
  scores,
  analyses,
  threshold,
}: SleepCalendarProps) {
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
  const selectedFlag = flagKind(selectedAnalysis);

  const shownFlags = new Set(
    allDays.map((d) => flagKind(analyses[format(d, "yyyy-MM-dd")]))
  );
  const flagLegend = (["up", "down", "unclear"] as const).filter((kind) =>
    shownFlags.has(kind)
  );

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
              const isFuture = isAfter(day, today);
              const isSelected = selectedDay === key;
              const isTodayCell = key === format(today, "yyyy-MM-dd");
              const hasData = !!night;
              const band = score != null ? scoreBand(score) : null;
              const flag = flagKind(analyses[key]);

              const total = night?.totalSleepDuration ?? null;
              const deep = night?.deepSleepDuration ?? null;
              const rem = night?.remSleepDuration ?? null;
              const light = night?.lightSleepDuration ?? null;
              const hasStageComposition =
                total != null &&
                total > 0 &&
                deep != null &&
                rem != null &&
                light != null;
              const deepPct =
                hasStageComposition ? (deep / total) * 100 : null;
              const remPct =
                hasStageComposition ? (rem / total) * 100 : null;
              const lightPct =
                hasStageComposition ? (light / total) * 100 : null;

              const label = [
                `Night of ${formatNightLabel(key).replace(" → ", " to ")}`,
                band
                  ? `sleep score ${score}, ${band.label}`
                  : !hasData && !isFuture
                    ? "no sleep data"
                    : null,
                flag ? FLAG_LABELS[flag].toLowerCase() : null,
              ]
                .filter(Boolean)
                .join("; ");

              return (
                <button
                  key={key}
                  type="button"
                  disabled={isFuture}
                  onClick={() => setSelectedDay(key)}
                  aria-label={label}
                  aria-pressed={isSelected}
                  aria-current={isTodayCell ? "date" : undefined}
                  className={cn(
                    "relative aspect-square md:aspect-auto md:h-20 rounded-md p-1 md:p-2 text-left transition-all motion-reduce:transition-none",
                    "flex flex-col items-center md:items-start justify-center md:justify-between",
                    hasData && "border bg-card",
                    !isFuture && !hasData && "border border-dashed",
                    isFuture && "opacity-30 cursor-not-allowed",
                    !isFuture && "cursor-pointer",
                    !isFuture &&
                      !isSelected &&
                      "hover:ring-1 hover:ring-muted-foreground/40",
                    isSelected && "ring-2 ring-primary",
                    !isSelected && isTodayCell && "ring-1 ring-muted-foreground/30"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs self-start leading-none tabular-nums",
                      !hasData && !isFuture
                        ? "text-faint-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>

                  {band && (
                    <span
                      className={cn(
                        "text-sm md:text-lg font-bold leading-none tabular-nums",
                        band.text
                      )}
                    >
                      {score}
                    </span>
                  )}

                  {flag && (
                    <span className="absolute top-1 right-1 md:top-2 md:right-2">
                      <FlagMarker kind={flag} />
                    </span>
                  )}

                  {hasData && hasStageComposition && (
                    <div
                      aria-hidden="true"
                      className="hidden md:flex w-full h-[3px] rounded-full overflow-hidden mt-auto"
                    >
                      <div
                        className={STAGE_STYLES.deep.className}
                        style={{ width: `${deepPct!}%` }}
                      />
                      <div
                        className={STAGE_STYLES.rem.className}
                        style={{ width: `${remPct!}%` }}
                      />
                      <div
                        className={STAGE_STYLES.light.className}
                        style={{ width: `${lightPct!}%` }}
                      />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {flagLegend.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {flagLegend.map((kind) => (
            <li key={kind} className="inline-flex items-center gap-1.5">
              <FlagMarker kind={kind} />
              {FLAG_LABELS[kind]}
            </li>
          ))}
        </ul>
      )}

      <Panel
        id="selected-night"
        title={formatNightLabel(selectedDay)}
        meta={
          selectedNight && selectedScore != null ? (
            <ScoreMeta score={selectedScore} />
          ) : undefined
        }
        description={
          selectedNight && selectedFlag ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <Pill tone="attention">Flagged night</Pill>
              {selectedFlag !== "unclear" && (
                <PatternDirectionLabel
                  direction={selectedAnalysis?.anomalyDirection}
                />
              )}
            </span>
          ) : undefined
        }
      >
        {selectedNight ? (
          <NightCardContent
            night={selectedNight}
            analysis={selectedAnalysis}
            threshold={threshold}
          />
        ) : (
          <EmptyState title="No sleep data for this day" />
        )}
      </Panel>
    </div>
  );
}
