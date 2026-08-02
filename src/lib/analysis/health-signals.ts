import { db } from "@/lib/db";
import {
  dailyReadiness,
  dailySpo2,
  sleepPeriods,
  cyclePredictions,
  healthSignals,
} from "@/lib/db/schema";
import { gte, lte, desc, and, isNotNull, eq, lt } from "drizzle-orm";
import { format, subDays, differenceInDays, parseISO } from "date-fns";
import { getTodayET } from "@/lib/date-utils";
import { isNextCalendarDay } from "./baseline";
import type { CycleComputationOutcome } from "./cycle";

type SignalType =
  | "sustained_temperature"
  | "acute_illness"
  | "thermal_shift_timing";

interface HealthSignal {
  day: string;
  signalType: SignalType;
  status: "detected" | "resolved";
  evidenceStrength: number;
  indicators: string[];
  summary: string;
  details: string;
}

interface DatedValue {
  day: string;
  value: number;
}

function orderedUnique<T extends { day: string }>(rows: T[]): T[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export function latestConsecutiveValues(
  rows: DatedValue[],
  maximumDays: number
): DatedValue[] {
  const ordered = orderedUnique(rows);
  if (ordered.length === 0) return [];

  const result = [ordered[ordered.length - 1]];
  for (
    let index = ordered.length - 2;
    index >= 0 && result.length < maximumDays;
    index--
  ) {
    if (!isNextCalendarDay(ordered[index].day, result[0].day)) break;
    result.unshift(ordered[index]);
  }
  return result;
}

export function longestConsecutiveMatchingRun(
  rows: DatedValue[],
  predicate: (value: number) => boolean
): number {
  const ordered = orderedUnique(rows);
  let longest = 0;
  let current = 0;
  let previousDay: string | null = null;

  for (const row of ordered) {
    const isConsecutive =
      previousDay == null || isNextCalendarDay(previousDay, row.day);
    current = isConsecutive && predicate(row.value) ? current + 1 : predicate(row.value) ? 1 : 0;
    longest = Math.max(longest, current);
    previousDay = row.day;
  }
  return longest;
}

export function latestConsecutiveMatchingRun(
  rows: DatedValue[],
  predicate: (value: number) => boolean
): number {
  const ordered = orderedUnique(rows);
  let run = 0;
  let nextDay: string | null = null;

  for (let index = ordered.length - 1; index >= 0; index--) {
    const row = ordered[index];
    if (!predicate(row.value)) break;
    if (nextDay != null && !isNextCalendarDay(row.day, nextDay)) break;
    run++;
    nextDay = row.day;
  }

  return run;
}

export function isRecentMeasurementDay(
  measurementDay: string,
  today: string
): boolean {
  return (
    measurementDay === today || isNextCalendarDay(measurementDay, today)
  );
}

export function isWithinRecentCalendarDays(
  measurementDay: string,
  today: string,
  maximumAgeDays: number
): boolean {
  const age = differenceInDays(parseISO(today), parseISO(measurementDay));
  return age >= 0 && age <= maximumAgeDays;
}

export function personalBaselineZScore(
  currentValue: number,
  baselineValues: number[]
): number | null {
  if (baselineValues.length < 2) return null;
  const mean =
    baselineValues.reduce((sum, value) => sum + value, 0) /
    baselineValues.length;
  const standardDeviation = Math.sqrt(
    baselineValues.reduce(
      (sum, value) => sum + (value - mean) ** 2,
      0
    ) /
      (baselineValues.length - 1)
  );
  return standardDeviation > 0
    ? (currentValue - mean) / standardDeviation
    : null;
}

function resolvedSummary(signalType: string): string {
  if (
    signalType === "early_pregnancy" ||
    signalType === "sustained_temperature"
  ) {
    return "The previously observed sustained temperature pattern is not present in the latest eligible data.";
  }
  if (signalType === "acute_illness") {
    return "The previously observed physiological strain pattern is not present in the latest eligible data.";
  }
  return "The previously observed cycle-variation pattern is not present in the latest eligible data.";
}

export function isCycleDependentHealthSignal(signalType: string): boolean {
  return (
    signalType === "early_pregnancy" ||
    signalType === "sustained_temperature" ||
    signalType === "thermal_shift_timing"
  );
}

export function canEvaluateCycleHealthSignals(
  cycleEvaluation: CycleComputationOutcome
): boolean {
  return cycleEvaluation.state === "complete";
}

export function getHealthSignalResolutionCopy(
  signalType: string,
  todayStr: string,
  cycleSignalsAreEligible: boolean
): { summary: string; details: string } {
  if (
    !cycleSignalsAreEligible &&
    isCycleDependentHealthSignal(signalType)
  ) {
    return {
      summary:
        "This prior temperature-based signal is no longer active because current coverage is insufficient to reevaluate it.",
      details: `Marked inactive on ${todayStr}; retained historical thermal shifts were not reused without a complete current temperature evaluation.`,
    };
  }

  return {
    summary: resolvedSummary(signalType),
    details: `Resolved on ${todayStr} after reevaluating current eligible data.`,
  };
}

export async function runHealthSignalDetection(
  cycleEvaluation: CycleComputationOutcome
): Promise<{
  signals: number;
  resolved: number;
}> {
  const todayStr = getTodayET();
  const todayDate = new Date(`${todayStr}T12:00:00`);
  const now = Math.floor(Date.now() / 1000);

  const cycleSignalsAreEligible =
    canEvaluateCycleHealthSignals(cycleEvaluation);
  const detectedSignals = (
    await Promise.all([
      cycleSignalsAreEligible
        ? detectSustainedTemperaturePattern(todayStr, todayDate)
        : Promise.resolve([]),
      detectAcuteIllness(todayStr, todayDate),
      cycleSignalsAreEligible
        ? detectThermalShiftTimingChange(todayStr)
        : Promise.resolve([]),
    ])
  ).flat();

  const currentKeys = new Set(
    detectedSignals.map((signal) => `${signal.day}:${signal.signalType}`)
  );
  const activeRows = await db
    .select({
      id: healthSignals.id,
      day: healthSignals.day,
      signalType: healthSignals.signalType,
    })
    .from(healthSignals)
    .where(eq(healthSignals.status, "detected"));

  let resolved = 0;
  for (const activeRow of activeRows) {
    if (currentKeys.has(`${activeRow.day}:${activeRow.signalType}`)) continue;
    const resolutionCopy = getHealthSignalResolutionCopy(
      activeRow.signalType,
      todayStr,
      cycleSignalsAreEligible
    );
    await db
      .update(healthSignals)
      .set({
        status: "resolved",
        confidence: 0,
        indicators: "[]",
        summary: resolutionCopy.summary,
        details: resolutionCopy.details,
        updatedAt: now,
      })
      .where(eq(healthSignals.id, activeRow.id));
    resolved++;
  }

  for (const signal of detectedSignals) {
    await db
      .insert(healthSignals)
      .values({
        day: signal.day,
        signalType: signal.signalType,
        status: signal.status,
        confidence: signal.evidenceStrength,
        indicators: JSON.stringify(signal.indicators),
        summary: signal.summary,
        details: signal.details,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [healthSignals.day, healthSignals.signalType],
        set: {
          status: signal.status,
          confidence: signal.evidenceStrength,
          indicators: JSON.stringify(signal.indicators),
          summary: signal.summary,
          details: signal.details,
          updatedAt: now,
        },
      });
  }

  return { signals: detectedSignals.length, resolved };
}

async function detectSustainedTemperaturePattern(
  todayStr: string,
  todayDate: Date
): Promise<HealthSignal[]> {
  const cycles = await db
    .select()
    .from(cyclePredictions)
    .orderBy(desc(cyclePredictions.cycleNumber))
    .limit(3);
  const latestWithShift = cycles.find(
    (cycle) =>
      cycle.thermalShiftDay != null &&
      cycle.periodStartDay == null &&
      cycle.nextPeriodDay == null &&
      cycle.confidence != null &&
      cycle.confidence > 0.3
  );
  if (!latestWithShift?.thermalShiftDay) return [];

  const shiftDate = parseISO(latestWithShift.thermalShiftDay);
  const daysSinceShift = differenceInDays(todayDate, shiftDate);
  if (daysSinceShift < 10 || daysSinceShift > 30) return [];

  const postShiftCutoff = latestWithShift.thermalShiftDay;
  const preShiftCutoff = format(
    subDays(shiftDate, 14),
    "yyyy-MM-dd"
  );
  const [postShiftTemps, postShiftHr, baselineTemps, baselineHr] =
    await Promise.all([
      db
        .select({
          day: dailyReadiness.day,
          value: dailyReadiness.temperatureDeviation,
        })
        .from(dailyReadiness)
        .where(
          and(
            gte(dailyReadiness.day, postShiftCutoff),
            lte(dailyReadiness.day, todayStr),
            isNotNull(dailyReadiness.temperatureDeviation)
          )
        )
        .orderBy(dailyReadiness.day),
      db
        .select({
          day: sleepPeriods.day,
          value: sleepPeriods.averageHeartRate,
        })
        .from(sleepPeriods)
        .where(
          and(
            gte(sleepPeriods.day, postShiftCutoff),
            lte(sleepPeriods.day, todayStr),
            isNotNull(sleepPeriods.averageHeartRate),
            eq(sleepPeriods.type, "long_sleep")
          )
        )
        .orderBy(sleepPeriods.day),
      db
        .select({
          day: dailyReadiness.day,
          value: dailyReadiness.temperatureDeviation,
        })
        .from(dailyReadiness)
        .where(
          and(
            gte(dailyReadiness.day, preShiftCutoff),
            lt(dailyReadiness.day, postShiftCutoff),
            isNotNull(dailyReadiness.temperatureDeviation)
          )
        )
        .orderBy(dailyReadiness.day),
      db
        .select({
          day: sleepPeriods.day,
          value: sleepPeriods.averageHeartRate,
        })
        .from(sleepPeriods)
        .where(
          and(
            gte(sleepPeriods.day, preShiftCutoff),
            lt(sleepPeriods.day, postShiftCutoff),
            isNotNull(sleepPeriods.averageHeartRate),
            eq(sleepPeriods.type, "long_sleep")
          )
        )
        .orderBy(sleepPeriods.day),
    ]);

  const baselineTemperatureRun = latestConsecutiveValues(
    baselineTemps.filter(
      (row): row is DatedValue => row.value != null
    ),
    14
  );
  if (baselineTemperatureRun.length < 7) return [];

  const eligiblePostShiftTemperatures = postShiftTemps.filter(
    (row): row is DatedValue => row.value != null
  );
  const latestTemperatureDay =
    eligiblePostShiftTemperatures[eligiblePostShiftTemperatures.length - 1]
      ?.day;
  if (
    !latestTemperatureDay ||
    !isRecentMeasurementDay(latestTemperatureDay, todayStr)
  ) {
    return [];
  }

  const baselineTemperature =
    baselineTemperatureRun.reduce((sum, row) => sum + row.value, 0) /
    baselineTemperatureRun.length;
  const consecutiveTemperatureDays = latestConsecutiveMatchingRun(
    eligiblePostShiftTemperatures,
    (value) => value > baselineTemperature + 0.15
  );
  if (consecutiveTemperatureDays < 10) return [];

  const indicators = [
    `Nighttime skin-temperature deviation remained elevated for ${consecutiveTemperatureDays} calendar-consecutive days after a detected thermal shift`,
  ];
  let evidenceStrength =
    consecutiveTemperatureDays >= 18
      ? 0.55
      : consecutiveTemperatureDays >= 14
        ? 0.4
        : 0.25;

  const baselineHeartRateRun = latestConsecutiveValues(
    baselineHr.filter((row): row is DatedValue => row.value != null),
    14
  );
  if (baselineHeartRateRun.length >= 7) {
    const baselineHeartRate =
      baselineHeartRateRun.reduce((sum, row) => sum + row.value, 0) /
      baselineHeartRateRun.length;
    const eligiblePostShiftHeartRate = postShiftHr.filter(
      (row): row is DatedValue => row.value != null
    );
    const latestHeartRateDay =
      eligiblePostShiftHeartRate[eligiblePostShiftHeartRate.length - 1]?.day;
    const consecutiveHeartRateDays =
      latestHeartRateDay === latestTemperatureDay
        ? latestConsecutiveMatchingRun(
            eligiblePostShiftHeartRate,
            (value) => value > baselineHeartRate + 3
          )
        : 0;
    if (consecutiveHeartRateDays >= 7) {
      evidenceStrength += consecutiveHeartRateDays >= 14 ? 0.15 : 0.08;
      indicators.push(
        `Average heart rate during the Oura long-sleep period was elevated for ${consecutiveHeartRateDays} calendar-consecutive days`
      );
    }
  }

  return [
    {
      day: latestTemperatureDay,
      signalType: "sustained_temperature",
      status: "detected",
      evidenceStrength: Math.min(evidenceStrength, 1),
      indicators,
      summary:
        "A sustained temperature pattern followed an app-detected thermal shift. This pattern is nonspecific.",
      details: `${consecutiveTemperatureDays} consecutive elevated temperature-deviation days; ${daysSinceShift} days after the detected thermal shift.`,
    },
  ];
}

async function detectAcuteIllness(
  todayStr: string,
  todayDate: Date
): Promise<HealthSignal[]> {
  const baselineCutoff = format(subDays(todayDate, 21), "yyyy-MM-dd");
  const recentCutoff = format(subDays(todayDate, 2), "yyyy-MM-dd");

  const [hrData, temperatureData, hrvData, spo2Data] = await Promise.all([
    db
      .select({
        day: sleepPeriods.day,
        value: sleepPeriods.averageHeartRate,
      })
      .from(sleepPeriods)
      .where(
        and(
          gte(sleepPeriods.day, baselineCutoff),
          lte(sleepPeriods.day, todayStr),
          isNotNull(sleepPeriods.averageHeartRate),
          eq(sleepPeriods.type, "long_sleep")
        )
      )
      .orderBy(sleepPeriods.day),
    db
      .select({
        day: dailyReadiness.day,
        value: dailyReadiness.temperatureDeviation,
      })
      .from(dailyReadiness)
      .where(
        and(
          gte(dailyReadiness.day, baselineCutoff),
          lte(dailyReadiness.day, todayStr),
          isNotNull(dailyReadiness.temperatureDeviation)
        )
      )
      .orderBy(dailyReadiness.day),
    db
      .select({ day: sleepPeriods.day, value: sleepPeriods.averageHrv })
      .from(sleepPeriods)
      .where(
        and(
          gte(sleepPeriods.day, baselineCutoff),
          lte(sleepPeriods.day, todayStr),
          isNotNull(sleepPeriods.averageHrv),
          eq(sleepPeriods.type, "long_sleep")
        )
      )
      .orderBy(sleepPeriods.day),
    db
      .select({ day: dailySpo2.day, value: dailySpo2.averageSpo2 })
      .from(dailySpo2)
      .where(
        and(
          gte(dailySpo2.day, baselineCutoff),
          lte(dailySpo2.day, todayStr),
          isNotNull(dailySpo2.averageSpo2)
        )
      )
      .orderBy(dailySpo2.day),
  ]);

  const baselineHeartRate = latestConsecutiveValues(
    hrData
      .filter(
        (row): row is DatedValue =>
          row.value != null && row.day < recentCutoff
      ),
    14
  );
  const recentHeartRate = hrData
    .filter(
      (row): row is DatedValue =>
        row.value != null && row.day >= recentCutoff
    )
    .sort((a, b) => a.day.localeCompare(b.day));
  if (baselineHeartRate.length < 7 || recentHeartRate.length === 0) return [];

  const latestHeartRate = recentHeartRate[recentHeartRate.length - 1];
  const heartRateZ = personalBaselineZScore(
    latestHeartRate.value,
    baselineHeartRate.map((row) => row.value)
  );
  if (heartRateZ == null || heartRateZ <= 2) return [];

  const indicators = [
    `Average heart rate during the Oura long-sleep period was ${heartRateZ.toFixed(1)} standard deviations above its recent baseline`,
  ];
  let evidenceStrength = 0.4;

  const baselineHrv = latestConsecutiveValues(
    hrvData
      .filter(
        (row): row is DatedValue =>
          row.value != null && row.day < recentCutoff
      ),
    14
  );
  const currentHrv = hrvData.find(
    (row) => row.day === latestHeartRate.day && row.value != null
  );
  if (baselineHrv.length >= 5 && currentHrv?.value != null) {
    const hrvMean =
      baselineHrv.reduce((sum, row) => sum + row.value, 0) /
      baselineHrv.length;
    const hrvDrop = (hrvMean - currentHrv.value) / hrvMean;
    if (hrvDrop > 0.15) {
      evidenceStrength += 0.2;
      indicators.push(
        `Nighttime HRV was ${Math.round(hrvDrop * 100)}% below its recent baseline`
      );
    }
  }

  const baselineTemperature = latestConsecutiveValues(
    temperatureData
      .filter(
        (row): row is DatedValue =>
          row.value != null && row.day < recentCutoff
      ),
    14
  );
  const currentTemperature = temperatureData.find(
    (row) => row.day === latestHeartRate.day && row.value != null
  );
  if (
    baselineTemperature.length >= 5 &&
    currentTemperature?.value != null
  ) {
    const temperatureMean =
      baselineTemperature.reduce((sum, row) => sum + row.value, 0) /
      baselineTemperature.length;
    const temperatureElevation = currentTemperature.value - temperatureMean;
    if (temperatureElevation > 0.2) {
      evidenceStrength += 0.2;
      indicators.push(
        `Nighttime skin-temperature deviation was ${temperatureElevation.toFixed(2)}°C above its recent baseline`
      );
    }
  }

  const currentSpo2 = spo2Data.find(
    (row) => row.day === latestHeartRate.day && row.value != null
  );
  if (currentSpo2?.value != null && currentSpo2.value < 95) {
    evidenceStrength += 0.1;
    indicators.push(
      `Average overnight SpO₂ was ${currentSpo2.value}%`
    );
  }

  if (indicators.length < 2) return [];

  return [
    {
      day: latestHeartRate.day,
      signalType: "acute_illness",
      status: "detected",
      evidenceStrength: Math.min(evidenceStrength, 1),
      indicators,
      summary:
        "Multiple measurements show a physiological strain pattern. This pattern is not specific to illness.",
      details: `Oura long-sleep average heart-rate z-score ${heartRateZ.toFixed(1)} with ${indicators.length - 1} supporting measurement${indicators.length === 2 ? "" : "s"}.`,
    },
  ];
}

async function detectThermalShiftTimingChange(
  todayStr: string
): Promise<HealthSignal[]> {
  const cycles = await db
    .select()
    .from(cyclePredictions)
    .orderBy(desc(cyclePredictions.cycleNumber))
    .limit(12);
  const observedShifts = cycles.filter(
    (cycle) =>
      cycle.thermalShiftDay != null &&
      cycle.thermalShiftDay <= todayStr &&
      cycle.periodStartDay == null &&
      cycle.nextPeriodDay == null &&
      cycle.confidence != null &&
      cycle.confidence >= 0.3
  );
  if (observedShifts.length === 0) return [];

  const latest = observedShifts[0];
  if (
    !latest.thermalShiftDay ||
    !isWithinRecentCalendarDays(latest.thermalShiftDay, todayStr, 7)
  ) {
    return [];
  }
  const indicators: string[] = [];
  let evidenceStrength = 0;

  const priorLengths = observedShifts
    .slice(1)
    .map((cycle) => cycle.interShiftDays)
    .filter(
      (interShiftDays): interShiftDays is number =>
        interShiftDays != null && interShiftDays >= 20 && interShiftDays <= 50
    );
  if (
    latest.interShiftDays != null &&
    priorLengths.length >= 3
  ) {
    const mean =
      priorLengths.reduce((sum, value) => sum + value, 0) /
      priorLengths.length;
    const standardDeviation = Math.sqrt(
      priorLengths.reduce(
        (sum, value) => sum + (value - mean) ** 2,
        0
      ) /
        (priorLengths.length - 1)
    );
    const deviation =
      standardDeviation > 0
        ? Math.abs(latest.interShiftDays - mean) / standardDeviation
        : 0;
    if (deviation > 2) {
      evidenceStrength = Math.min(0.7, 0.35 + deviation / 10);
      indicators.push(
        `Latest detected thermal-shift interval was ${latest.interShiftDays} days versus a prior mean of ${Math.round(mean)} days`
      );
    }
  }

  if (indicators.length === 0) return [];

  return [
    {
      day: latest.thermalShiftDay,
      signalType: "thermal_shift_timing",
      status: "detected",
      evidenceStrength,
      indicators,
      summary:
        "The interval between detected thermal shifts differs from the recent pattern. Temperature patterns can vary for many reasons.",
      details: `${indicators.length} thermal-shift timing indicator${indicators.length === 1 ? "" : "s"} present.`,
    },
  ];
}
