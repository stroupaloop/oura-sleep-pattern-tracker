"use client";

import { useState } from "react";
import { CircadianChart } from "@/components/charts/circadian-chart";
import { ActivityRecoveryChart } from "@/components/charts/activity-recovery-chart";
import { VariabilityChart } from "@/components/charts/variability-chart";
import { WithinNightChart } from "@/components/charts/within-night-chart";
import { CorrelationView } from "@/components/charts/correlation-view";

const TABS = [
  { id: "circadian", label: "Circadian Rhythms" },
  { id: "activity", label: "Activity & Recovery" },
  { id: "variability", label: "Sleep Variability" },
  { id: "within-night", label: "Within-Night" },
  { id: "correlations", label: "Correlations" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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
  anomalyScore: number | null;
  anomalyDirection: string | null;
  isAnomaly: number | null;
  totalSleepMinutes: number | null;
  moodScore: number | null;
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
}

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
}

export function InsightsTabs({ analysis, episodes, workouts, moods }: InsightsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("circadian");

  const episodeMap = new Map(episodes.map((e) => [e.day, e]));

  const circadianData = analysis.map((a) => {
    const ep = episodeMap.get(a.day);
    return {
      day: a.day,
      is: a.circadianIS,
      iv: a.circadianIV,
      ra: a.circadianRA,
      isEpisode: !!ep && ep.tier !== "none",
      episodeTier: ep?.tier,
    };
  });

  const workoutsByDay = new Map<string, { count: number; calories: number; types: string[] }>();
  for (const w of workouts) {
    const existing = workoutsByDay.get(w.day) ?? { count: 0, calories: 0, types: [] };
    existing.count++;
    if (w.calories) existing.calories += w.calories;
    if (w.activity && !existing.types.includes(w.activity)) existing.types.push(w.activity);
    workoutsByDay.set(w.day, existing);
  }

  const activityData = analysis.map((a) => {
    const w = workoutsByDay.get(a.day);
    return {
      day: a.day,
      steps: a.steps,
      activeMinutes: a.activeMinutes,
      stressHigh: a.stressHigh,
      recoveryHigh: a.recoveryHigh,
      resilienceLevel: a.resilienceLevel,
      workoutCount: w?.count ?? 0,
      workoutCalories: w?.calories ?? 0,
      workoutTypes: w?.types ?? [],
    };
  });

  const variabilityData = analysis.map((a) => ({
    day: a.day,
    sleepCV: a.dayToDaySleepCV,
    bedtimeCV: a.dayToDayBedtimeCV,
    wakeCV: a.dayToDayWakeCV,
  }));

  const withinNightData = analysis.map((a) => ({
    day: a.day,
    hrvCV: a.withinNightHrvCV,
    hrCV: a.withinNightHrCV,
    fragmentation: a.hypnogramFragmentation,
  }));

  const moodMap = new Map(moods.map((m) => [m.day, m]));

  const correlationPairs = [
    {
      title: "HRV vs Sleep Efficiency",
      xLabel: "HRV (ms)",
      yLabel: "Efficiency (%)",
      data: analysis
        .filter((a) => a.avgHrv && a.efficiency)
        .map((a) => ({
          day: a.day,
          x: a.avgHrv!,
          y: a.efficiency!,
          anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
        })),
    },
    {
      title: "Steps vs Anomaly Score",
      xLabel: "Steps",
      yLabel: "Anomaly Score",
      data: analysis
        .filter((a) => a.steps && a.anomalyScore != null)
        .map((a) => ({
          day: a.day,
          x: a.steps!,
          y: a.anomalyScore!,
          anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
        })),
    },
    {
      title: "Bedtime CV vs Anomaly Score",
      xLabel: "Bedtime CV",
      yLabel: "Anomaly Score",
      data: analysis
        .filter((a) => a.dayToDayBedtimeCV && a.anomalyScore != null)
        .map((a) => ({
          day: a.day,
          x: a.dayToDayBedtimeCV!,
          y: a.anomalyScore!,
          anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
        })),
    },
    {
      title: "Within-Night HRV CV vs Episode Confidence",
      xLabel: "HRV CV",
      yLabel: "Confidence",
      data: analysis
        .filter((a) => a.withinNightHrvCV)
        .map((a) => {
          const ep = episodeMap.get(a.day);
          return {
            day: a.day,
            x: a.withinNightHrvCV!,
            y: ep?.confidence ?? 0,
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
      xLabel: "Irritability (0-10)",
      yLabel: "Deep Sleep %",
      data: analysis
        .filter((a) => {
          const m = moodMap.get(a.day);
          return m?.irritabilityScore != null && a.efficiency != null;
        })
        .map((a) => {
          const m = moodMap.get(a.day)!;
          return {
            day: a.day,
            x: m.irritabilityScore!,
            y: a.efficiency!,
            anomalyDirection: a.isAnomaly ? a.anomalyDirection : null,
          };
        }),
    },
    {
      title: "Anxiety vs HRV",
      xLabel: "Anxiety (0-10)",
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
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "circadian" && (
        <CircadianChart
          data={circadianData}
          limitations="Circadian metrics require continuous ring wear for accuracy. IS computed from 3-day activity windows."
        />
      )}
      {activeTab === "activity" && (
        <ActivityRecoveryChart
          data={activityData}
          limitations="Activity data may be incomplete on days with low ring wear time."
        />
      )}
      {activeTab === "variability" && (
        <VariabilityChart
          data={variabilityData}
          limitations="CV requires at least 3 days in the rolling window. Higher values indicate more irregular patterns."
        />
      )}
      {activeTab === "within-night" && (
        <WithinNightChart
          data={withinNightData}
          limitations="Within-night metrics require 5-min HR/HRV data from long sleep periods."
        />
      )}
      {activeTab === "correlations" && (
        <CorrelationView pairs={correlationPairs} />
      )}
    </div>
  );
}
