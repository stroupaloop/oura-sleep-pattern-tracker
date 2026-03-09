import { db } from "@/lib/db";
import { dailyReadiness, restModePeriods, cyclePredictions } from "@/lib/db/schema";
import { gte, gt, and, isNotNull } from "drizzle-orm";
import { format, subDays, differenceInDays, addDays, parseISO } from "date-fns";

interface TempPoint {
  day: string;
  temperatureDelta: number;
}

interface DetectedCycle {
  cycleNumber: number;
  periodStartDay: string | null;
  ovulationDay: string | null;
  nextPeriodDay: string | null;
  cycleLength: number | null;
  confidence: number;
}

function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function detectThermalShifts(
  temps: TempPoint[],
  smoothed: number[],
  excludedDays: Set<string>
): number[] {
  const shiftIndices: number[] = [];

  for (let i = 9; i < temps.length - 2; i++) {
    if (excludedDays.has(temps[i].day)) continue;

    const priorSlice: number[] = [];
    for (let j = i - 6; j < i; j++) {
      if (j >= 0 && !excludedDays.has(temps[j].day)) {
        priorSlice.push(smoothed[j]);
      }
    }
    if (priorSlice.length < 3) continue;

    const priorMean = priorSlice.reduce((a, b) => a + b, 0) / priorSlice.length;
    const threshold = priorMean + 0.15;

    let consecutiveAbove = 0;
    for (let k = i; k < Math.min(i + 4, smoothed.length); k++) {
      if (!excludedDays.has(temps[k].day) && smoothed[k] >= threshold) {
        consecutiveAbove++;
      } else {
        break;
      }
    }

    if (consecutiveAbove >= 3) {
      const tooClose = shiftIndices.some((prev) => i - prev < 15);
      if (!tooClose) {
        shiftIndices.push(i);
      }
    }
  }

  return shiftIndices;
}

export async function computeCyclePredictions(): Promise<DetectedCycle[]> {
  const cutoff = format(subDays(new Date(), 365), "yyyy-MM-dd");

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

  if (temps.length < 30) {
    console.log(`[cycle] Insufficient temperature data: ${temps.length}/30 required. Returning empty.`);
    return [];
  }

  const rawValues = temps.map((t) => t.temperatureDelta);
  const smoothed = movingAverage(rawValues, 5);

  const shiftIndices = detectThermalShifts(temps, smoothed, excludedDays);
  console.log(`[cycle] Thermal shifts detected: ${shiftIndices.length}`);

  if (shiftIndices.length === 0) {
    console.log("[cycle] No thermal shifts found. Returning empty.");
    return [];
  }

  const cycles: DetectedCycle[] = [];
  const lutealLengths: number[] = [];

  for (let c = 0; c < shiftIndices.length; c++) {
    const ovIdx = shiftIndices[c];
    const ovDay = temps[ovIdx].day;

    let periodStart: string | null = null;
    let irregularGap = false;
    if (c === 0) {
      periodStart = format(addDays(parseISO(ovDay), -14), "yyyy-MM-dd");
      irregularGap = true;
    } else {
      const prevOvIdx = shiftIndices[c - 1];
      const prevOvDay = temps[prevOvIdx].day;
      const gapDays = differenceInDays(parseISO(ovDay), parseISO(prevOvDay));

      if (gapDays >= 20 && gapDays <= 45) {
        const estLuteal = lutealLengths.length > 0
          ? Math.round(lutealLengths.reduce((a, b) => a + b, 0) / lutealLengths.length)
          : 14;
        periodStart = format(addDays(parseISO(prevOvDay), estLuteal), "yyyy-MM-dd");
      } else {
        periodStart = format(addDays(parseISO(ovDay), -14), "yyyy-MM-dd");
        irregularGap = true;
      }
    }

    let cycleLength: number | null = null;
    if (c > 0 && periodStart) {
      const prevCycle = cycles[cycles.length - 1];
      if (prevCycle?.periodStartDay) {
        cycleLength = differenceInDays(parseISO(periodStart), parseISO(prevCycle.periodStartDay));
      }
    }

    if (c > 0) {
      const prevOvIdx = shiftIndices[c - 1];
      const prevOvDay = temps[prevOvIdx].day;
      if (periodStart) {
        const luteal = differenceInDays(parseISO(periodStart), parseISO(prevOvDay));
        if (luteal >= 10 && luteal <= 18) {
          lutealLengths.push(luteal);
        }
      }
    }

    let confidence = 0.5;
    const postShiftTemps: number[] = [];
    for (let k = ovIdx; k < Math.min(ovIdx + 5, smoothed.length); k++) {
      if (!excludedDays.has(temps[k].day)) {
        postShiftTemps.push(smoothed[k]);
      }
    }
    const preShiftTemps: number[] = [];
    for (let k = Math.max(0, ovIdx - 6); k < ovIdx; k++) {
      if (!excludedDays.has(temps[k].day)) {
        preShiftTemps.push(smoothed[k]);
      }
    }
    if (postShiftTemps.length >= 3 && preShiftTemps.length >= 3) {
      const preMean = preShiftTemps.reduce((a, b) => a + b, 0) / preShiftTemps.length;
      const postMean = postShiftTemps.reduce((a, b) => a + b, 0) / postShiftTemps.length;
      const shift = postMean - preMean;
      if (shift >= 0.3) confidence = 0.85;
      else if (shift >= 0.2) confidence = 0.7;
      else confidence = 0.5;
    }

    if (cycleLength != null && cycleLength >= 24 && cycleLength <= 35) {
      confidence = Math.min(1, confidence + 0.1);
    }

    if (irregularGap) {
      confidence = Math.min(confidence, 0.3);
    }

    cycles.push({
      cycleNumber: c + 1,
      periodStartDay: periodStart,
      ovulationDay: ovDay,
      nextPeriodDay: null,
      cycleLength,
      confidence,
    });
  }

  if (cycles.length > 0) {
    const last = cycles[cycles.length - 1];
    const avgLuteal = lutealLengths.length > 0
      ? Math.round(lutealLengths.reduce((a, b) => a + b, 0) / lutealLengths.length)
      : 14;

    const cycleLengths = cycles
      .map((c) => c.cycleLength)
      .filter((l): l is number => l != null && l >= 20 && l <= 45);
    const avgCycleLength = cycleLengths.length > 0
      ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
      : 28;

    if (last.ovulationDay) {
      last.nextPeriodDay = format(addDays(parseISO(last.ovulationDay), avgLuteal), "yyyy-MM-dd");
    }

    const anchorStr = last.periodStartDay ?? last.nextPeriodDay;

    const FORWARD_CYCLES = 3;
    if (anchorStr) {
      let cursor: Date = parseISO(anchorStr);
      const today = new Date();
      const maxFuture = addDays(today, 90);

      for (let f = 0; f < FORWARD_CYCLES; f++) {
        const nextStart: Date = addDays(cursor, avgCycleLength);
        if (nextStart > maxFuture) break;

        const prevCycle = cycles[cycles.length - 1];
        if (prevCycle && !prevCycle.nextPeriodDay) {
          prevCycle.nextPeriodDay = format(nextStart, "yyyy-MM-dd");
        }

        const estOvulation: Date = addDays(nextStart, avgCycleLength - avgLuteal);
        cycles.push({
          cycleNumber: cycles.length + 1,
          periodStartDay: format(nextStart, "yyyy-MM-dd"),
          ovulationDay: estOvulation <= maxFuture ? format(estOvulation, "yyyy-MM-dd") : null,
          nextPeriodDay: null,
          cycleLength: avgCycleLength,
          confidence: 0.15,
        });

        cursor = nextStart;
      }
    }
  }

  console.log(`[cycle] Cycles computed: ${cycles.length}`);
  return cycles;
}

export async function runCyclePredictions(): Promise<{ cyclesDetected: number }> {
  const cycles = await computeCyclePredictions();

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
          confidence: cycle.confidence,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: cyclePredictions.cycleNumber,
          set: {
            periodStartDay: cycle.periodStartDay,
            ovulationDay: cycle.ovulationDay,
            nextPeriodDay: cycle.nextPeriodDay,
            cycleLength: cycle.cycleLength,
            confidence: cycle.confidence,
          },
        });
    }

    await db.delete(cyclePredictions)
      .where(gt(cyclePredictions.cycleNumber, cycles.length));
  }

  return { cyclesDetected: cycles.length };
}
