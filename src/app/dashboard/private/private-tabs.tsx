"use client";

import { useState } from "react";
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

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "heart-rate", label: "Heart Rate" },
  { id: "cycle", label: "Cycle" },
  { id: "fitness", label: "Fitness" },
  { id: "sleep-timing", label: "Sleep Timing" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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
  cycleData: {
    cycleNumber: number;
    periodStartDay: string | null;
    ovulationDay: string | null;
    nextPeriodDay: string | null;
    cycleLength: number | null;
    evidenceScore: number | null;
  }[];
  temperatureData: { day: string; temperatureDelta: number | null }[];
  eligibleTemperatureRun: number;
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
}

function describeEvidence(score: number): string {
  if (score >= 0.7) return "Higher";
  if (score >= 0.4) return "Moderate";
  return "Limited";
}

export function PrivateTabs(props: PrivateTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab {...props} />}
      {activeTab === "heart-rate" && <HeartRateTab {...props} />}
      {activeTab === "cycle" && <CycleTab {...props} />}
      {activeTab === "fitness" && <FitnessTab {...props} />}
      {activeTab === "sleep-timing" && <SleepTimingTab bedtimeData={props.bedtimeData} />}
    </div>
  );
}

function OverviewTab({
  personalInfo,
  healthSignals: healthSignalsProp,
}: PrivateTabsProps) {
  return (
    <div className="space-y-6">
      <HealthSignalsCard signals={healthSignalsProp} />

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

function CycleTab({
  currentDay,
  cycleData,
  temperatureData,
  eligibleTemperatureRun,
  cyclePhaseDaily,
}: PrivateTabsProps) {
  const today = currentDay;
  const detectedShifts = cycleData
    .filter(
      (cycle) =>
        cycle.ovulationDay != null &&
        cycle.ovulationDay <= today &&
        (cycle.evidenceScore ?? 0) >= 0.3
    )
    .sort((a, b) => b.ovulationDay!.localeCompare(a.ovulationDay!));
  const latestShift = detectedShifts[0] ?? null;
  const thermalShiftDays = detectedShifts
    .map((c) => c.ovulationDay)
    .filter((d): d is string => d != null);
  const hasCurrentIntervalSemantics =
    latestShift?.periodStartDay == null &&
    latestShift?.nextPeriodDay == null;

  const validTempData = temperatureData.filter((d) => d.temperatureDelta != null);
  const hasReadinessData = temperatureData.length > 0;
  const hasValidTemp = validTempData.length > 0;

  return (
    <div className="space-y-6">
      {latestShift ? (
        <Card>
          <CardHeader>
            <CardTitle>Thermal Shift Summary</CardTitle>
            <CardDescription>
              Sustained changes detected in Oura nighttime skin-temperature deviation. This does not identify ovulation, menstruation, or fertility.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {latestShift.ovulationDay && (
                <div>
                  <span className="text-muted-foreground">Latest Detected Shift</span>
                  <p className="font-medium">{latestShift.ovulationDay}</p>
                </div>
              )}
              {hasCurrentIntervalSemantics && latestShift.cycleLength != null && (
                <div>
                  <span className="text-muted-foreground">Previous Shift Interval</span>
                  <p className="font-medium">{latestShift.cycleLength} days</p>
                </div>
              )}
              {latestShift.evidenceScore != null && (
                <div>
                  <span className="text-muted-foreground">Evidence Strength</span>
                  <p className="font-medium">
                    {describeEvidence(latestShift.evidenceScore)}
                  </p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              This evidence score is not a probability. Medication, illness, alcohol, and travel can affect temperature patterns.
            </p>
          </CardContent>
        </Card>
      ) : hasReadinessData ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              {!hasValidTemp
                ? "Nighttime skin-temperature deviation is not available from Oura yet. This typically requires consistent nightly wear."
                : eligibleTemperatureRun < 30
                  ? `Not enough consecutive eligible nighttime temperature data for this app rule (${eligibleTemperatureRun}/30 consecutive days).`
                  : "No sustained thermal shift matched the app's current rules. Medication, irregular sleep, illness, alcohol, and travel can affect the pattern."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              No thermal-shift result is available. Oura nighttime temperature data typically requires consistent nightly wear.
            </p>
          </CardContent>
        </Card>
      )}

      {detectedShifts.length > 0 && (
        <CycleCalendar cycleData={detectedShifts} currentDay={currentDay} />
      )}

      {detectedShifts.length > 0 && cyclePhaseDaily.length > 0 && (
        <CyclePhaseChart
          dailyData={cyclePhaseDaily}
          thermalShiftDays={thermalShiftDays}
        />
      )}

      {hasValidTemp ? (
        <CycleTemperatureChart
          data={temperatureData}
          thermalShiftDays={thermalShiftDays}
        />
      ) : hasReadinessData ? (
        <Card>
          <CardHeader>
            <CardTitle>Temperature Trend</CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Oura nighttime skin-temperature deviation is not available yet. It usually appears after consistent nightly wear.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {detectedShifts.filter(
        (cycle) =>
          cycle.periodStartDay == null &&
          cycle.nextPeriodDay == null &&
          cycle.cycleLength != null
      ).length > 0 && (
        <CycleLengthChart
          data={detectedShifts
            .filter(
              (cycle) =>
                cycle.periodStartDay == null &&
                cycle.nextPeriodDay == null &&
                cycle.cycleLength != null
            )
            .map((c) => ({ cycleNumber: c.cycleNumber, cycleLength: c.cycleLength! }))
            .reverse()}
        />
      )}
    </div>
  );
}

function FitnessTab({
  cvAgeData,
  vo2Data,
  personalInfo,
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

      {!hasCvAge && !hasVo2 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              No fitness estimates are available. Oura Cardiovascular Age and VO₂ max require sufficient eligible data.
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
  return (
    <div className="space-y-6">
      {bedtimeData.length > 0 ? (
        <BedtimeTrendChart data={bedtimeData} />
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground text-center">
              No sleep timing data available. Sync your Oura data to see bedtime trends.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
