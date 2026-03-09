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

const TABS = [
  { id: "body", label: "Body" },
  { id: "sleep-timing", label: "Sleep Timing" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface PrivateTabsProps {
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
    confidence: number | null;
  }[];
  temperatureData: { day: string; temperatureDelta: number | null }[];
  bedtimeData: {
    day: string;
    actualBedtime: number | null;
    optimalStart: number | null;
    optimalEnd: number | null;
  }[];
}

export function PrivateTabs(props: PrivateTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("body");

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

      {activeTab === "body" && <BodyTab {...props} />}
      {activeTab === "sleep-timing" && <SleepTimingTab bedtimeData={props.bedtimeData} />}
    </div>
  );
}

function BodyTab({
  cvAgeData,
  vo2Data,
  personalInfo,
  cycleData,
  temperatureData,
}: PrivateTabsProps) {
  const latestCycle = cycleData[0];
  const ovulationDays = cycleData
    .map((c) => c.ovulationDay)
    .filter((d): d is string => d != null);

  const validTempData = temperatureData.filter((d) => d.temperatureDelta != null);
  const hasSleepData = temperatureData.length > 0;
  const hasValidTemp = validTempData.length > 0;

  return (
    <div className="space-y-6">
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

      {latestCycle ? (
        <Card>
          <CardHeader>
            <CardTitle>Cycle Prediction</CardTitle>
            <CardDescription>
              Based on basal body temperature (BBT) analysis. Not a contraceptive method.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {latestCycle.periodStartDay && (
                <div>
                  <span className="text-muted-foreground">Last Period Start</span>
                  <p className="font-medium">{latestCycle.periodStartDay}</p>
                </div>
              )}
              {latestCycle.ovulationDay && (
                <div>
                  <span className="text-muted-foreground">Ovulation</span>
                  <p className="font-medium">{latestCycle.ovulationDay}</p>
                </div>
              )}
              {latestCycle.nextPeriodDay && (() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const isPast = latestCycle.nextPeriodDay < todayStr;
                return (
                  <div>
                    <span className="text-muted-foreground">
                      {isPast ? "Next Period (overdue)" : "Next Period (est.)"}
                    </span>
                    <p className={`font-medium ${isPast ? "text-amber-400" : ""}`}>
                      {isPast
                        ? `Overdue — expected ${latestCycle.nextPeriodDay}`
                        : latestCycle.nextPeriodDay}
                    </p>
                  </div>
                );
              })()}
              {latestCycle.cycleLength != null && (
                <div>
                  <span className="text-muted-foreground">Cycle Length</span>
                  <p className="font-medium">{latestCycle.cycleLength} days</p>
                </div>
              )}
              {latestCycle.confidence != null && (
                <div>
                  <span className="text-muted-foreground">Confidence</span>
                  <p className="font-medium">{Math.round(latestCycle.confidence * 100)}%</p>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Bipolar medication can affect temperature patterns. Illness, alcohol, and travel may disrupt readings.
            </p>
          </CardContent>
        </Card>
      ) : hasSleepData ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              {!hasValidTemp
                ? "Temperature data not available from your Oura ring. Your ring may not report temperature deviations yet — this typically requires a few weeks of consistent wear."
                : validTempData.length < 30
                  ? `Not enough temperature data for cycle detection (${validTempData.length}/30 days needed). Keep wearing your ring nightly to build up data.`
                  : "No thermal shifts detected in available data. This can happen with medication, irregular sleep, or travel."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {cycleData.length > 0 && <CycleCalendar cycleData={cycleData} />}

      {hasValidTemp ? (
        <CycleTemperatureChart data={temperatureData} ovulationDays={ovulationDays} />
      ) : hasSleepData ? (
        <Card>
          <CardHeader>
            <CardTitle>Temperature Trend</CardTitle>
          </CardHeader>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Temperature data not available from your Oura ring. This data usually appears after a few weeks of consistent nightly wear.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {cycleData.length > 1 && (
        <CycleLengthChart
          data={cycleData
            .filter((c) => c.cycleLength != null)
            .map((c) => ({ cycleNumber: c.cycleNumber, cycleLength: c.cycleLength! }))
            .reverse()}
        />
      )}

      {cvAgeData.length > 0 && (
        <CardiovascularAgeChart
          data={cvAgeData}
          actualAge={personalInfo?.age}
        />
      )}

      {vo2Data.length > 0 && <Vo2MaxChart data={vo2Data} />}
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
