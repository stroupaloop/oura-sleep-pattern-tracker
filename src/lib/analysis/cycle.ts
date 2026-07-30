import { db } from "@/lib/db";
import { dailyReadiness, restModePeriods, cyclePredictions } from "@/lib/db/schema";
import { gte, and, isNotNull } from "drizzle-orm";
import { format, subDays, differenceInDays, addDays, parseISO } from "date-fns";
import { getTodayET } from "@/lib/date-utils";
import { isNextCalendarDay } from "./baseline";

interface TempPoint {
  day: string;
  temperatureDelta: number;
}

export interface DetectedThermalShift {
  cycleNumber: number;
  periodStartDay: string | null;
  ovulationDay: string | null;
  nextPeriodDay: string | null;
  cycleLength: number | null;
  evidenceStrength: number;
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
      ovulationDay: temps[shiftIndex].day,
      nextPeriodDay: null,
      cycleLength: shiftInterval,
      evidenceStrength,
    };
  });
}

export async function computeCyclePredictions(): Promise<DetectedThermalShift[]> {
  const todayDate = new Date(getTodayET() + "T12:00:00");
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

  const excludedDays = new Set<string>();
  for (const rest of restRows) {
    if (rest.startDay && rest.endDay) {
      const start = parseISO(rest.startDay);
      const end = parseISO(rest.endDay);
      const span = differenceInDays(end, start);
      for (let d = 0; d <= span; d++) {
        excludedDays.add(format(addDays(start, d), "yyyy-MM-dd"));
      }
    }
  }

  const temps: TempPoint[] = tempRows.map((r) => ({
    day: r.day,
    temperatureDelta: r.temperatureDelta!,
  }));

  const longestRun = longestConsecutiveTemperatureRun(temps, excludedDays);
  if (longestRun < 30) {
    console.log(
      `[cycle] Insufficient consecutive temperature data: ${longestRun}/30 required. Returning empty.`
    );
    return [];
  }

  const shiftIndices = detectThermalShifts(temps, excludedDays);
  console.log(`[cycle] Thermal shifts detected: ${shiftIndices.length}`);

  if (shiftIndices.length === 0) {
    console.log("[cycle] No thermal shifts found. Returning empty.");
    return [];
  }

  const records = buildThermalShiftRecords(temps, shiftIndices);
  console.log(`[cycle] Thermal-shift records computed: ${records.length}`);
  return records;
}

export async function runCyclePredictions(): Promise<{ cyclesDetected: number }> {
  const cycles = await computeCyclePredictions();
  await db.delete(cyclePredictions);

  if (cycles.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    for (const cycle of cycles) {
      await db
        .insert(cyclePredictions)
        .values({
          cycleNumber: cycle.cycleNumber,
          periodStartDay: cycle.periodStartDay,
          ovulationDay: cycle.ovulationDay,
          nextPeriodDay: cycle.nextPeriodDay,
          cycleLength: cycle.cycleLength,
          confidence: cycle.evidenceStrength,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: cyclePredictions.cycleNumber,
          set: {
            periodStartDay: cycle.periodStartDay,
            ovulationDay: cycle.ovulationDay,
            nextPeriodDay: cycle.nextPeriodDay,
            cycleLength: cycle.cycleLength,
            confidence: cycle.evidenceStrength,
          },
        });
    }
  }

  return { cyclesDetected: cycles.length };
}
