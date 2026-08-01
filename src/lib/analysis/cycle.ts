import { db } from "@/lib/db";
import { dailyReadiness, restModePeriods, cyclePredictions } from "@/lib/db/schema";
import { gte, and, isNotNull } from "drizzle-orm";
import {
  format,
  subDays,
  differenceInDays,
  differenceInCalendarDays,
  addDays,
  parseISO,
} from "date-fns";
import { getTodayET } from "@/lib/date-utils";
import { isNextCalendarDay } from "./baseline";

interface TempPoint {
  day: string;
  temperatureDelta: number;
}

export interface DetectedThermalShift {
  cycleNumber: number;
  periodStartDay: string | null;
  thermalShiftDay: string;
  nextPeriodDay: string | null;
  interShiftDays: number | null;
  evidenceStrength: number;
}

export interface CycleComputationOutcome {
  state: "complete" | "insufficient_data";
  cycles: DetectedThermalShift[];
  eligibleTemperatureRun: number;
}

interface RestModeDateRange {
  startDay: string | null;
  endDay: string | null;
}

export function buildRestModeDaySet(
  periods: RestModeDateRange[],
  rangeStartDay: string,
  rangeEndDay: string
): Set<string> {
  const days = new Set<string>();
  if (rangeStartDay > rangeEndDay) return days;

  for (const period of periods) {
    if (!period.startDay) continue;
    const startDay =
      period.startDay < rangeStartDay ? rangeStartDay : period.startDay;
    const periodEndDay = period.endDay ?? rangeEndDay;
    const endDay = periodEndDay > rangeEndDay ? rangeEndDay : periodEndDay;
    if (startDay > endDay) continue;

    const start = parseISO(startDay);
    const end = parseISO(endDay);
    const span = differenceInCalendarDays(end, start);
    if (!Number.isFinite(span) || span < 0) continue;

    for (let offset = 0; offset <= span; offset++) {
      days.add(format(addDays(start, offset), "yyyy-MM-dd"));
    }
  }

  return days;
}

function isConsecutiveRange(
  temps: TempPoint[],
  start: number,
  end: number,
  excludedDays: Set<string>
): boolean {
  if (start < 0 || end >= temps.length || start > end) return false;
  for (let index = start; index <= end; index++) {
    if (excludedDays.has(temps[index].day)) return false;
    if (
      index > start &&
      !isNextCalendarDay(temps[index - 1].day, temps[index].day)
    ) {
      return false;
    }
  }
  return true;
}

export function longestConsecutiveTemperatureRun(
  temps: TempPoint[],
  excludedDays: Set<string>
): number {
  let longest = 0;
  let current = 0;
  let previousDay: string | null = null;

  for (const temp of temps) {
    if (
      excludedDays.has(temp.day) ||
      (previousDay != null && !isNextCalendarDay(previousDay, temp.day))
    ) {
      current = excludedDays.has(temp.day) ? 0 : 1;
    } else {
      current++;
    }
    if (!excludedDays.has(temp.day)) {
      longest = Math.max(longest, current);
      previousDay = temp.day;
    } else {
      previousDay = null;
    }
  }
  return longest;
}

export function detectThermalShifts(
  temps: TempPoint[],
  excludedDays: Set<string>
): number[] {
  const shiftIndices: number[] = [];

  for (let i = 6; i < temps.length - 2; i++) {
    if (!isConsecutiveRange(temps, i - 6, i + 2, excludedDays)) continue;

    const priorSlice = temps
      .slice(i - 6, i)
      .map((temp) => temp.temperatureDelta);
    const priorMean = priorSlice.reduce((a, b) => a + b, 0) / priorSlice.length;
    const threshold = priorMean + 0.15;
    const consecutiveAbove = temps
      .slice(i, i + 3)
      .every((temp) => temp.temperatureDelta >= threshold);

    if (consecutiveAbove) {
      const tooClose = shiftIndices.some(
        (previousIndex) =>
          differenceInDays(
            parseISO(temps[i].day),
            parseISO(temps[previousIndex].day)
          ) < 15
      );
      if (!tooClose) {
        shiftIndices.push(i);
      }
    }
  }

  return shiftIndices;
}

export function buildThermalShiftRecords(
  temps: TempPoint[],
  shiftIndices: number[]
): DetectedThermalShift[] {
  return shiftIndices.map((shiftIndex, index) => {
    const priorValues = temps
      .slice(Math.max(0, shiftIndex - 6), shiftIndex)
      .map((temp) => temp.temperatureDelta);
    const postValues = temps
      .slice(shiftIndex, Math.min(shiftIndex + 3, temps.length))
      .map((temp) => temp.temperatureDelta);
    const priorMean =
      priorValues.reduce((sum, value) => sum + value, 0) /
      priorValues.length;
    const postMean =
      postValues.reduce((sum, value) => sum + value, 0) /
      postValues.length;
    const shiftAmplitude = postMean - priorMean;
    const evidenceStrength =
      shiftAmplitude >= 0.3 ? 0.8 : shiftAmplitude >= 0.2 ? 0.6 : 0.4;
    const previousShiftIndex = shiftIndices[index - 1];
    const shiftInterval =
      previousShiftIndex == null
        ? null
        : differenceInDays(
            parseISO(temps[shiftIndex].day),
            parseISO(temps[previousShiftIndex].day)
          );

    return {
      cycleNumber: index + 1,
      periodStartDay: null,
      thermalShiftDay: temps[shiftIndex].day,
      nextPeriodDay: null,
      interShiftDays: shiftInterval,
      evidenceStrength,
    };
  });
}

export function evaluateCycleTemperatures(
  temps: TempPoint[],
  excludedDays: Set<string>
): CycleComputationOutcome {
  const eligibleTemperatureRun = longestConsecutiveTemperatureRun(
    temps,
    excludedDays
  );
  if (eligibleTemperatureRun < 30) {
    return {
      state: "insufficient_data",
      cycles: [],
      eligibleTemperatureRun,
    };
  }

  const shiftIndices = detectThermalShifts(temps, excludedDays);
  return {
    state: "complete",
    cycles: buildThermalShiftRecords(temps, shiftIndices),
    eligibleTemperatureRun,
  };
}

export async function computeCyclePredictions(): Promise<CycleComputationOutcome> {
  const todayStr = getTodayET();
  const todayDate = new Date(todayStr + "T12:00:00");
  const cutoff = format(subDays(todayDate, 365), "yyyy-MM-dd");

  const [tempRows, restRows] = await Promise.all([
    db
      .select({
        day: dailyReadiness.day,
        temperatureDelta: dailyReadiness.temperatureDeviation,
      })
      .from(dailyReadiness)
      .where(
        and(
          gte(dailyReadiness.day, cutoff),
          isNotNull(dailyReadiness.temperatureDeviation)
        )
      )
      .orderBy(dailyReadiness.day),
    db.select().from(restModePeriods),
  ]);

  console.log(
    `[cycle] Readiness rows with temperatureDeviation: ${tempRows.length}, rest periods: ${restRows.length}`
  );

  const excludedDays = buildRestModeDaySet(restRows, cutoff, todayStr);

  const temps: TempPoint[] = tempRows.map((r) => ({
    day: r.day,
    temperatureDelta: r.temperatureDelta!,
  }));

  const outcome = evaluateCycleTemperatures(temps, excludedDays);
  if (outcome.state === "insufficient_data") {
    console.log(
      `[cycle] Insufficient consecutive temperature data: ${outcome.eligibleTemperatureRun}/30 required. Retaining prior results.`
    );
    return outcome;
  }

  console.log(`[cycle] Thermal shifts detected: ${outcome.cycles.length}`);
  return outcome;
}

export async function runCyclePredictions(
  compute: () => Promise<CycleComputationOutcome> = computeCyclePredictions
): Promise<{
  cyclesDetected: number;
  state: "replaced" | "retained_insufficient_data";
  eligibleTemperatureRun: number;
}> {
  const outcome = await compute();
  if (outcome.state === "insufficient_data") {
    return {
      cyclesDetected: 0,
      state: "retained_insufficient_data",
      eligibleTemperatureRun: outcome.eligibleTemperatureRun,
    };
  }

  await db.transaction(async (tx) => {
    await tx.delete(cyclePredictions);
    if (outcome.cycles.length > 0) {
      const now = Math.floor(Date.now() / 1000);
      await tx
        .insert(cyclePredictions)
        .values(
          outcome.cycles.map((cycle) => ({
            cycleNumber: cycle.cycleNumber,
            periodStartDay: cycle.periodStartDay,
            thermalShiftDay: cycle.thermalShiftDay,
            nextPeriodDay: cycle.nextPeriodDay,
            interShiftDays: cycle.interShiftDays,
            confidence: cycle.evidenceStrength,
            createdAt: now,
          }))
        );
    }
  });

  return {
    cyclesDetected: outcome.cycles.length,
    state: "replaced",
    eligibleTemperatureRun: outcome.eligibleTemperatureRun,
  };
}
