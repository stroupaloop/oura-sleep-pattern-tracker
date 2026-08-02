"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardiovascularAgeChart } from "@/components/charts/cardiovascular-age-chart";
import { Vo2MaxChart } from "@/components/charts/vo2-max-chart";
import { CycleTemperatureChart } from "@/components/charts/cycle-temperature-chart";
import { CycleLengthChart } from "@/components/charts/cycle-length-chart";

import { BedtimeTrendChart } from "@/components/charts/bedtime-trend-chart";
import { CycleCalendar } from "@/components/charts/cycle-calendar";
import { RestingHrChart } from "@/components/charts/resting-hr-chart";
import { HourlyHrChart } from "@/components/charts/hourly-hr-chart";
import { HealthSignalsCard, type HealthSignalData } from "@/components/health-signals-card";
import { CyclePhaseChart } from "@/components/charts/cycle-phase-chart";
import { WearActivityChart } from "@/components/charts/wear-activity-chart";
import type { WearActivityDay } from "@/components/charts/wear-activity-chart";
import type { HourlyHrPoint } from "@/lib/hr-anomalies";
import type { CycleComputationOutcome } from "@/lib/analysis/cycle";
import type { DatasetFreshness } from "@/lib/oura/freshness";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "heart-rate", label: "Heart Rate" },
  { id: "cycle", label: "Cycle Context" },
  { id: "fitness", label: "Fitness" },
  { id: "sleep-timing", label: "Sleep Timing" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function getPrivateTabIndexForKey(
  key: string,
  currentIndex: number,
  tabCount: number
): number | null {
  if (tabCount <= 0 || currentIndex < 0 || currentIndex >= tabCount) {
    return null;
  }

  if (key === "ArrowRight") return (currentIndex + 1) % tabCount;
  if (key === "ArrowLeft") return (currentIndex - 1 + tabCount) % tabCount;
  if (key === "Home") return 0;
  if (key === "End") return tabCount - 1;
  return null;
}

interface PrivateTabsProps {
  currentDay: string;
  cvAgeData: { day: string; vascularAge: number | null }[];
  vo2Data: { day: string; vo2Max: number | null }[];
  personalInfo: {
    age: number | null;
    height: number | null;
    weight: number | null;
    biologicalSex: string | null;
  } | null;
  cycleEvaluation: CycleComputationOutcome;
  temperatureData: {
    day: string;
    temperatureDelta: number | null;
    restModeExcluded: boolean;
  }[];
  bedtimeData: {
    day: string;
    actualBedtime: number | null;
    optimalStart: number | null;
    optimalEnd: number | null;
  }[];
  hrData: {
    day: string;
    restingBpm: number | null;
    awakeBpm: number | null;
    minBpm: number | null;
    maxBpm: number | null;
  }[];
  hourlyHrData: HourlyHrPoint[];
  healthSignals: HealthSignalData[];
  cyclePhaseDaily: {
    day: string;
    sleepHours: number | null;
    efficiency: number | null;
    avgHrv: number | null;
    moodScore: number | null;
    temperatureDelta: number | null;
  }[];
  wearActivityData: WearActivityDay[];
  wearActivityHrData: { day: string; hour: number; avgBpm: number | null; source: string | null }[];
  sourceFreshness: {
    sleep: DatasetFreshness;
    cardiovascularAge: DatasetFreshness;
    vo2Max: DatasetFreshness;
    bedtimeGuidance: DatasetFreshness;
  };
}

function describeEvidence(score: number): string {
  if (score >= 0.7) return "Higher";
  if (score >= 0.4) return "Moderate";
  return "Limited";
}

export function PrivateTabs(props: PrivateTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeTabIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const activeTabDefinition = TABS[activeTabIndex];

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) {
    const nextIndex = getPrivateTabIndexForKey(
      event.key,
      currentIndex,
      TABS.length
    );
    if (nextIndex == null) return;

    event.preventDefault();
    setActiveTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Private data sections"
        aria-orientation="horizontal"
        className="flex gap-2 overflow-x-auto pb-2"
      >
        {TABS.map((tab, index) => (
          <Button
            key={tab.id}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            id={`private-tab-${tab.id}`}
            role="tab"
            aria-controls={`private-panel-${tab.id}`}
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
        const isActive = activeTabDefinition.id === tab.id;
        return (
          <div
            key={tab.id}
            id={`private-panel-${tab.id}`}
            role="tabpanel"
            aria-labelledby={`private-tab-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            hidden={!isActive}
          >
            {isActive && tab.id === "overview" && <OverviewTab {...props} />}
            {isActive && tab.id === "heart-rate" && (
              <HeartRateTab {...props} />
            )}
            {isActive && tab.id === "cycle" && <CycleTab {...props} />}
            {isActive && tab.id === "fitness" && <FitnessTab {...props} />}
            {isActive && tab.id === "sleep-timing" && (
              <SleepTimingTab bedtimeData={props.bedtimeData} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function OverviewTab({
  personalInfo,
  healthSignals: healthSignalsProp,
  sourceFreshness,
}: PrivateTabsProps) {
  return (
    <div className="space-y-6">
      <HealthSignalsCard signals={healthSignalsProp} />

      <SourceFreshnessCard data={sourceFreshness} />

      {personalInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Personal Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {personalInfo.age != null && (
                <div>
                  <span className="text-muted-foreground">Age</span>
                  <p className="font-medium">{personalInfo.age}</p>
                </div>
              )}
              {personalInfo.height != null && (
                <div>
                  <span className="text-muted-foreground">Height</span>
                  <p className="font-medium">{personalInfo.height} cm</p>
                </div>
              )}
              {personalInfo.weight != null && (
                <div>
                  <span className="text-muted-foreground">Weight</span>
                  <p className="font-medium">{personalInfo.weight} kg</p>
                </div>
              )}
              {personalInfo.biologicalSex && (
                <div>
                  <span className="text-muted-foreground">Biological Sex</span>
                  <p className="font-medium capitalize">{personalInfo.biologicalSex}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatSourceDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function freshnessValue(data: DatasetFreshness): string {
  if (data.state === "retained" && data.lastSourceDay) {
    return `Retained through ${formatSourceDay(data.lastSourceDay)}`;
  }
  if (data.state === "unavailable") {
    return "Latest update unavailable · no saved value";
  }
  if (data.state === "checked" && data.lastSourceDay) {
    return `Through ${formatSourceDay(data.lastSourceDay)}`;
  }
  if (data.state === "checked") return "Checked · no value received";
  if (data.lastSourceDay) {
    return `Saved through ${formatSourceDay(data.lastSourceDay)} · sync status unknown`;
  }
  return "Not yet available";
}

function SourceFreshnessCard({
  data,
}: {
  data: PrivateTabsProps["sourceFreshness"];
}) {
  const rows = [
    ["Sleep", data.sleep],
    ["Cardiovascular Age", data.cardiovascularAge],
    ["VO₂ Max", data.vo2Max],
    ["Bedtime Guidance", data.bedtimeGuidance],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Oura Source Freshness</CardTitle>
        <CardDescription>
          Source dates are shown separately so retained values do not look newly
          updated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {rows.map(([label, freshness]) => (
            <div
              key={label}
              className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <dt className="text-sm font-medium">{label}</dt>
              <dd className="text-sm text-muted-foreground">
                {freshnessValue(freshness)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function missingFitnessCopy(
  metric: "Cardiovascular Age" | "VO₂ Max",
  freshness: DatasetFreshness
): string {
  if (freshness.state === "unavailable") {
    return `The latest Oura update for ${metric} was unavailable, and no saved value is available.`;
  }
  if (freshness.lastSourceDay) {
    const status =
      freshness.state === "retained"
        ? "The latest update was unavailable."
        : freshness.state === "unknown"
          ? "The latest sync status is unknown."
          : "The latest source check completed.";
    return `${status} No value appears in this 90-day view; the latest saved value is from ${formatSourceDay(freshness.lastSourceDay)}.`;
  }
  if (metric === "Cardiovascular Age") {
    return "No Cardiovascular Age value is currently available from Oura. The first baseline generally requires at least 14 eligible nights within the previous 30 days.";
  }
  return "No VO₂ Max value is currently available from Oura. Oura may establish it from profile data or a walking test, or store a value added manually.";
}

function HeartRateTab({
  currentDay,
  hrData,
  hourlyHrData,
  wearActivityData,
  wearActivityHrData,
}: PrivateTabsProps) {
  return (
    <div className="space-y-6">
      {hourlyHrData.length > 0 && <HourlyHrChart data={hourlyHrData} />}

      <WearActivityChart
        activityData={wearActivityData}
        hrData={wearActivityHrData}
        currentDay={currentDay}
      />

      {hrData.length > 0 && <RestingHrChart data={hrData} />}

      {hourlyHrData.length === 0 && hrData.length === 0 && wearActivityData.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              No heart rate data available. Sync your Oura data to see HR trends.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function getCycleEvaluationResultLabel(
  evaluation: CycleComputationOutcome
): string {
  if (evaluation.outcome === "insufficient_data") {
    return "Insufficient consecutive temperature data";
  }
  if (evaluation.outcome === "no_shifts") {
    return "No qualifying thermal shifts";
  }
  return `${evaluation.cycles.length} qualifying thermal shift${
    evaluation.cycles.length === 1 ? "" : "s"
  }`;
}

export function getCycleSecondaryChartVisibility(
  shiftCount: number,
  intervalCount: number
) {
  return {
    phaseWindows: shiftCount >= 2,
    calendar: shiftCount >= 2,
    intervals: intervalCount >= 3,
  };
}

function getCycleInsufficientCopy(
  reason: CycleComputationOutcome["insufficientReason"]
): string {
  if (reason === "no_temperature_data") {
    return "No Oura nighttime temperature deviation was received in this evaluation window.";
  }
  if (reason === "rest_mode_exclusions") {
    return "Without the recorded Rest Mode exclusions, this window would meet the required 30-night run.";
  }
  return "Available temperature days do not form the required 30-night consecutive run.";
}

function CycleTab({
  currentDay,
  cycleEvaluation,
  temperatureData,
  cyclePhaseDaily,
}: PrivateTabsProps) {
  const detectedShifts = cycleEvaluation.cycles
    .filter(
      (cycle) =>
        cycle.thermalShiftDay <= currentDay &&
        cycle.evidenceStrength >= 0.3
    )
    .sort((a, b) => b.thermalShiftDay.localeCompare(a.thermalShiftDay));
  const latestShift = detectedShifts[0] ?? null;
  const thermalShiftDays = detectedShifts.map(
    (cycle) => cycle.thermalShiftDay
  );
  const intervalData = detectedShifts
    .filter((cycle) => cycle.interShiftDays != null)
    .map((cycle) => ({
      cycleNumber: cycle.cycleNumber,
      interShiftDays: cycle.interShiftDays,
    }))
    .reverse();
  const chartVisibility = getCycleSecondaryChartVisibility(
    detectedShifts.length,
    intervalData.length
  );
  const hasReadinessData = temperatureData.length > 0;
  const hasValidTemp = temperatureData.some(
    (point) => point.temperatureDelta != null
  );
  const runCopy = `Ending on evaluation day: ${cycleEvaluation.currentEligibleTemperatureRun}/30 nights${
    cycleEvaluation.currentEligibleTemperatureRun ===
    cycleEvaluation.longestEligibleTemperatureRun
      ? ""
      : ` · longest ${cycleEvaluation.longestEligibleTemperatureRun}/30`
  }`;
  const restModeCopy = cycleEvaluation.restModeActive
    ? cycleEvaluation.restModeExcludedTemperatureDays > 0
      ? `Active · ${cycleEvaluation.restModeExcludedTemperatureDays} temperature nights excluded`
      : "Active · no temperature nights excluded yet"
    : cycleEvaluation.restModeExcludedTemperatureDays > 0
      ? `${cycleEvaluation.restModeExcludedTemperatureDays} temperature nights excluded`
      : "No temperature nights excluded";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cycle Context</CardTitle>
          <CardDescription>
            Temperature only · a 365-day app evaluation, not menstrual-cycle
            tracking or fertility guidance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Result</dt>
              <dd className="font-medium">
                {getCycleEvaluationResultLabel(cycleEvaluation)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Evaluation End</dt>
              <dd className="font-medium">
                {formatSourceDay(cycleEvaluation.checkedThroughDay)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Temperature Through</dt>
              <dd className="font-medium">
                {cycleEvaluation.latestTemperatureDay
                  ? formatSourceDay(cycleEvaluation.latestTemperatureDay)
                  : "Not available"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Eligible Run</dt>
              <dd className="font-medium">{runCopy}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Eligible Nights</dt>
              <dd className="font-medium">
                {cycleEvaluation.eligibleTemperatureDays}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rest Mode</dt>
              <dd className="font-medium">{restModeCopy}</dd>
            </div>
          </dl>

          {latestShift ? (
            <div className="border-t pt-4 text-sm">
              <p>
                Latest detected shift:{" "}
                <span className="font-medium">
                  {formatSourceDay(latestShift.thermalShiftDay)}
                </span>
                {" · "}
                {describeEvidence(latestShift.evidenceStrength)} pattern
                strength
                {latestShift.interShiftDays != null
                  ? ` · ${latestShift.interShiftDays} days since the prior shift`
                  : ""}
              </p>
            </div>
          ) : cycleEvaluation.outcome === "no_shifts" ? (
            <p className="border-t pt-4 text-sm text-muted-foreground">
              The evaluation completed and found zero shifts matching this app
              rule.
            </p>
          ) : (
            <p className="border-t pt-4 text-sm text-muted-foreground">
              {getCycleInsufficientCopy(cycleEvaluation.insufficientReason)}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            App rule: three consecutive nights at least 0.15°C above the prior
            six-night mean; a 30-night eligible run is required. Pattern
            strength is not a probability, and medication, illness, alcohol,
            travel, and hormonal changes can affect temperature.
          </p>
        </CardContent>
      </Card>

      {hasValidTemp ? (
        <CycleTemperatureChart
          data={temperatureData}
          thermalShiftDays={thermalShiftDays}
        />
      ) : hasReadinessData ? (
        <Card>
          <CardHeader>
            <CardTitle>Nighttime Skin-Temperature Deviation</CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Oura nighttime temperature deviation is not available in this
              90-day view.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {chartVisibility.phaseWindows && cyclePhaseDaily.length > 0 ? (
        <CyclePhaseChart
          dailyData={cyclePhaseDaily}
          thermalShiftDays={thermalShiftDays}
        />
      ) : null}

      {chartVisibility.intervals ? (
        <CycleLengthChart data={intervalData} />
      ) : null}

      {chartVisibility.calendar ? (
        <CycleCalendar
          cycleData={detectedShifts.map((cycle) => ({
            cycleNumber: cycle.cycleNumber,
            thermalShiftDay: cycle.thermalShiftDay,
            evidenceScore: cycle.evidenceStrength,
          }))}
          currentDay={currentDay}
        />
      ) : null}
    </div>
  );
}

function FitnessTab({
  cvAgeData,
  vo2Data,
  personalInfo,
  sourceFreshness,
}: PrivateTabsProps) {
  const hasCvAge = cvAgeData.some((d) => d.vascularAge != null);
  const hasVo2 = vo2Data.some((d) => d.vo2Max != null);

  return (
    <div className="space-y-6">
      {hasCvAge && (
        <CardiovascularAgeChart
          data={cvAgeData}
          actualAge={personalInfo?.age}
        />
      )}

      {hasVo2 && <Vo2MaxChart data={vo2Data} />}

      {!hasCvAge && (
        <Card>
          <CardHeader>
            <CardTitle>Cardiovascular Age</CardTitle>
          </CardHeader>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              {missingFitnessCopy(
                "Cardiovascular Age",
                sourceFreshness.cardiovascularAge
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {!hasVo2 && (
        <Card>
          <CardHeader>
            <CardTitle>VO₂ Max</CardTitle>
          </CardHeader>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              {missingFitnessCopy("VO₂ Max", sourceFreshness.vo2Max)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SleepTimingTab({
  bedtimeData,
}: {
  bedtimeData: PrivateTabsProps["bedtimeData"];
}) {
  return <BedtimeTrendChart data={bedtimeData} />;
}
