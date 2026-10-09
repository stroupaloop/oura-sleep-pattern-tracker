"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CircadianChart } from "@/components/charts/circadian-chart";
import { ActivityRecoveryChart } from "@/components/charts/activity-recovery-chart";
import { VariabilityChart } from "@/components/charts/variability-chart";
import { WithinNightChart } from "@/components/charts/within-night-chart";
import { CorrelationView } from "@/components/charts/correlation-view";
import { fillCalendarDays } from "@/lib/health/calendar-rows";
import { summarizeWorkoutsByDay } from "@/lib/workout-summary";

const TABS = [
  { id: "circadian", label: "Circadian Rhythms" },
  { id: "activity", label: "Activity & Recovery" },
  { id: "variability", label: "Sleep Variability" },
  { id: "within-night", label: "Within-Night" },
  { id: "correlations", label: "Relationships" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function tabIndexForKey(
  key: string,
  currentIndex: number,
  tabCount: number
): number | null {
  if (key === "ArrowRight") return (currentIndex + 1) % tabCount;
  if (key === "ArrowLeft") return (currentIndex - 1 + tabCount) % tabCount;
  if (key === "Home") return 0;
  if (key === "End") return tabCount - 1;
  return null;
}

interface AnalysisRow {
  day: string;
  circadianIS: number | null;
  circadianIV: number | null;
  circadianRA: number | null;
  steps: number | null;
  activeMinutes: number | null;
  stressHigh: number | null;
  recoveryHigh: number | null;
  resilienceLevel: string | null;
  dayToDaySleepCV: number | null;
  dayToDayBedtimeCV: number | null;
  dayToDayWakeCV: number | null;
  withinNightHrvCV: number | null;
  withinNightHrCV: number | null;
  hypnogramFragmentation: number | null;
  avgHrv: number | null;
  efficiency: number | null;
  deepPct: number | null;
  anomalyScore: number | null;
  anomalyDirection: string | null;
  isAnomaly: number | null;
  totalSleepMinutes: number | null;
  moodScore: number | null;
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
}

/** A calendar day of the window; `noNight` marks one the app has no night for. */
interface DayRow extends AnalysisRow {
  noNight?: boolean;
}

const NOT_ANALYSED: Omit<AnalysisRow, "day"> = {
  circadianIS: null,
  circadianIV: null,
  circadianRA: null,
  steps: null,
  activeMinutes: null,
  stressHigh: null,
  recoveryHigh: null,
  resilienceLevel: null,
  dayToDaySleepCV: null,
  dayToDayBedtimeCV: null,
  dayToDayWakeCV: null,
  withinNightHrvCV: null,
  withinNightHrCV: null,
  hypnogramFragmentation: null,
  avgHrv: null,
  efficiency: null,
  deepPct: null,
  anomalyScore: null,
  anomalyDirection: null,
  isAnomaly: null,
  totalSleepMinutes: null,
  moodScore: null,
  energyScore: null,
  irritabilityScore: null,
  anxietyScore: null,
};

interface WorkoutRow {
  day: string;
  activity: string | null;
  calories: number | null;
  distance: number | null;
  intensity: string | null;
  startDatetime: string | null;
  endDatetime: string | null;
}

interface MoodRow {
  day: string;
  moodScore: number;
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
}

interface EpisodeRow {
  day: string;
  tier: string;
  direction: string | null;
  confidence: number;
}

interface InsightsTabsProps {
  analysis: AnalysisRow[];
  episodes: EpisodeRow[];
  workouts: WorkoutRow[];
  moods: MoodRow[];
  /** The days the page covers, ending today. */
  range: { start: string; end: string };
  /** Days with a night recorded, analysed or not. */
  nightDays: string[];
}

export function InsightsTabs({
  analysis,
  episodes,
  workouts,
  moods,
  range,
  nightDays,
}: InsightsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("circadian");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    const nextIndex = tabIndexForKey(event.key, currentIndex, TABS.length);
    if (nextIndex == null) return;

    event.preventDefault();
    setActiveTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  const episodeMap = new Map(episodes.map((e) => [e.day, e]));

  const nightDaySet = new Set(nightDays);
  const days = fillCalendarDays<DayRow>(analysis, range, (day) => ({
    ...NOT_ANALYSED,
    day,
    noNight: !nightDaySet.has(day),
  }));

  const circadianData = days.map((a) => {
    const ep = episodeMap.get(a.day);
    return {
      day: a.day,
      is: a.circadianIS,
      iv: a.circadianIV,
      ra: a.circadianRA,
      isEpisode: !!ep && ep.tier !== "none",
      episodeTier: ep?.tier,
      noNight: a.noNight,
    };
  });

  const workoutsByDay = summarizeWorkoutsByDay(workouts);

  const activityData = days.map((a) => {
    const w = a.noNight ? undefined : workoutsByDay.get(a.day);
    return {
      day: a.day,
      steps: a.steps,
      activeMinutes: a.activeMinutes,
      stressHigh:
        a.stressHigh != null ? Math.round(a.stressHigh / 60) : null,
      recoveryHigh:
        a.recoveryHigh != null ? Math.round(a.recoveryHigh / 60) : null,
      resilienceLevel: a.resilienceLevel,
      workoutCount: w?.count ?? 0,
      workoutCalories: w?.calories ?? null,
      workoutTypes: w?.types ?? [],
      noNight: a.noNight,
    };
  });

  const variabilityData = days.map((a) => ({
    day: a.day,
    sleepCV: a.dayToDaySleepCV,
    bedtimeCV: a.dayToDayBedtimeCV,
    wakeCV: a.dayToDayWakeCV,
    noNight: a.noNight,
  }));

  const withinNightData = days.map((a) => ({
    day: a.day,
    hrvCV: a.withinNightHrvCV,
    hrCV: a.withinNightHrCV,
    fragmentation: a.hypnogramFragmentation,
    noNight: a.noNight,
  }));

  const moodMap = new Map(moods.map((m) => [m.day, m]));

  const correlationPairs = [
    {
      title: "HRV vs Sleep Efficiency",
      xLabel: "HRV (ms)",
      yLabel: "Efficiency (%)",
      data: analysis
        .filter((a) => a.avgHrv != null && a.efficiency != null)
        .map((a) => ({
          day: a.day,
          x: a.avgHrv!,
          y: a.efficiency!,
          anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
        })),
    },
    {
      title: "Steps vs Pattern Score",
      xLabel: "Steps",
      yLabel: "Pattern Score",
      data: analysis
        .filter((a) => a.steps != null && a.anomalyScore != null)
        .map((a) => ({
          day: a.day,
          x: a.steps!,
          y: a.anomalyScore!,
          anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
        })),
    },
    {
      title: "Bedtime Variation vs Pattern Score",
      xLabel: "Bedtime variation index",
      yLabel: "Pattern Score",
      data: analysis
        .filter((a) => a.dayToDayBedtimeCV != null && a.anomalyScore != null)
        .map((a) => ({
          day: a.day,
          x: a.dayToDayBedtimeCV!,
          y: a.anomalyScore!,
          anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
        })),
    },
    {
      title: "Within-Night HRV CV vs Episode Evidence Score",
      xLabel: "HRV CV",
      yLabel: "Evidence Score (0–10)",
      data: analysis
        .filter(
          (a) =>
            a.withinNightHrvCV != null &&
            episodeMap.has(a.day)
        )
        .map((a) => {
          const ep = episodeMap.get(a.day)!;
          return {
            day: a.day,
            x: a.withinNightHrvCV!,
            y: ep.confidence,
            anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
          };
        }),
    },
    {
      title: "Mood vs HRV",
      xLabel: "Mood (-3 to +3)",
      yLabel: "HRV (ms)",
      data: analysis
        .filter((a) => a.avgHrv != null && moodMap.has(a.day))
        .map((a) => ({
          day: a.day,
          x: moodMap.get(a.day)!.moodScore,
          y: a.avgHrv!,
          anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
        })),
    },
    {
      title: "Mood vs Sleep Duration",
      xLabel: "Mood (-3 to +3)",
      yLabel: "Sleep (h)",
      data: analysis
        .filter((a) => a.totalSleepMinutes != null && moodMap.has(a.day))
        .map((a) => ({
          day: a.day,
          x: moodMap.get(a.day)!.moodScore,
          y: +(a.totalSleepMinutes! / 60).toFixed(1),
          anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
        })),
    },
    {
      title: "Irritability vs Deep Sleep %",
      xLabel: "Irritability (1-5)",
      yLabel: "Deep Sleep %",
      data: analysis
        .filter((a) => {
          const m = moodMap.get(a.day);
          return m?.irritabilityScore != null && a.deepPct != null;
        })
        .map((a) => {
          const m = moodMap.get(a.day)!;
          return {
            day: a.day,
            x: m.irritabilityScore!,
            y: a.deepPct!,
            anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
          };
        }),
    },
    {
      title: "Anxiety vs HRV",
      xLabel: "Anxiety (1-5)",
      yLabel: "HRV (ms)",
      data: analysis
        .filter((a) => {
          const m = moodMap.get(a.day);
          return m?.anxietyScore != null && a.avgHrv != null;
        })
        .map((a) => {
          const m = moodMap.get(a.day)!;
          return {
            day: a.day,
            x: m.anxietyScore!,
            y: a.avgHrv!,
            anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
          };
        }),
    },
  ];

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Insight sections"
        aria-orientation="horizontal"
        className="flex gap-2 overflow-x-auto pb-2"
      >
        {TABS.map((tab, index) => (
          <Button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`insights-tab-${tab.id}`}
            role="tab"
            aria-controls={`insights-panel-${tab.id}`}
            aria-selected={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            className="min-h-11"
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <div
            key={tab.id}
            id={`insights-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`insights-tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            hidden={!isActive}
          >
            {isActive && tab.id === "circadian" && (
              <CircadianChart
                data={circadianData}
                limitations="Circadian metrics require continuous ring wear for accuracy. IS computed from 3-day activity windows."
              />
            )}
            {isActive && tab.id === "activity" && (
              <ActivityRecoveryChart
                data={activityData}
                limitations="Activity data may be incomplete on days with low ring wear time."
              />
            )}
            {isActive && tab.id === "variability" && (
              <VariabilityChart
                data={variabilityData}
                limitations="Rolling variability uses up to 7 consecutive calendar days and requires enough measured values. Higher values mean less regularity."
              />
            )}
            {isActive && tab.id === "within-night" && (
              <WithinNightChart
                data={withinNightData}
                limitations="CV requires 5-minute HR/HRV series; sleep-stage changes require a long-sleep hypnogram."
              />
            )}
            {isActive && tab.id === "correlations" && (
              <CorrelationView pairs={correlationPairs} />
            )}
          </div>
        );
      })}
    </div>
  );
}
