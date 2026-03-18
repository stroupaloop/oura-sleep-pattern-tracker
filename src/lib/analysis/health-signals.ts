import { db } from "@/lib/db";
import {
  dailyReadiness,
  dailyHeartrate,
  dailySpo2,
  sleepPeriods,
  cyclePredictions,
  healthSignals,
} from "@/lib/db/schema";
import { gte, desc, and, isNotNull, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { format, subDays, differenceInDays, parseISO } from "date-fns";
import { getTodayET } from "@/lib/date-utils";

interface HealthSignal {
  day: string;
  signalType: "early_pregnancy" | "acute_illness" | "cycle_irregularity";
  status: "detected" | "resolved";
  confidence: number;
  indicators: string[];
  summary: string;
  details: string;
}

export async function runHealthSignalDetection(): Promise<{ signals: number }> {
  const todayStr = getTodayET();
  const todayDate = new Date(todayStr + "T12:00:00");
  const now = Math.floor(Date.now() / 1000);

  const signals: HealthSignal[] = [];

  const [pregnancySignals, illnessSignals, cycleSignals] = await Promise.all([
    detectEarlyPregnancy(todayStr, todayDate),
    detectAcuteIllness(todayStr, todayDate),
    detectCycleIrregularity(todayStr, todayDate),
  ]);

  signals.push(...pregnancySignals, ...illnessSignals, ...cycleSignals);

  for (const signal of signals) {
    await db
      .insert(healthSignals)
      .values({
        day: signal.day,
        signalType: signal.signalType,
        status: signal.status,
        confidence: signal.confidence,
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
          confidence: signal.confidence,
          indicators: JSON.stringify(signal.indicators),
          summary: signal.summary,
          details: signal.details,
          updatedAt: now,
        },
      });
  }

  return { signals: signals.length };
}

async function detectEarlyPregnancy(
  todayStr: string,
  todayDate: Date
): Promise<HealthSignal[]> {
  const cycles = await db
    .select()
    .from(cyclePredictions)
    .orderBy(desc(cyclePredictions.cycleNumber))
    .limit(3);

  if (cycles.length === 0) return [];

  const latestWithOvulation = cycles.find((c) => c.ovulationDay && c.confidence && c.confidence > 0.3);
  if (!latestWithOvulation?.ovulationDay) return [];

  const ovDate = parseISO(latestWithOvulation.ovulationDay);
  const daysSinceOv = differenceInDays(todayDate, ovDate);

  if (daysSinceOv < 7 || daysSinceOv > 50) return [];

  const cutoff = latestWithOvulation.ovulationDay;
  const [tempData, hrData] = await Promise.all([
    db
      .select({
        day: dailyReadiness.day,
        tempDev: dailyReadiness.temperatureDeviation,
      })
      .from(dailyReadiness)
      .where(and(gte(dailyReadiness.day, cutoff), isNotNull(dailyReadiness.temperatureDeviation)))
      .orderBy(dailyReadiness.day),
    db
      .select({ day: dailyHeartrate.day, restingBpm: dailyHeartrate.restingBpm })
      .from(dailyHeartrate)
      .where(and(gte(dailyHeartrate.day, cutoff), isNotNull(dailyHeartrate.restingBpm)))
      .orderBy(dailyHeartrate.day),
  ]);

  if (tempData.length < 7) return [];

  const preOvCutoff = format(subDays(ovDate, 14), "yyyy-MM-dd");
  const [baselineTemp, baselineHr] = await Promise.all([
    db
      .select({ tempDev: dailyReadiness.temperatureDeviation })
      .from(dailyReadiness)
      .where(
        and(
          gte(dailyReadiness.day, preOvCutoff),
          isNotNull(dailyReadiness.temperatureDeviation)
        )
      )
      .orderBy(dailyReadiness.day),
    db
      .select({ restingBpm: dailyHeartrate.restingBpm })
      .from(dailyHeartrate)
      .where(and(gte(dailyHeartrate.day, preOvCutoff), isNotNull(dailyHeartrate.restingBpm)))
      .orderBy(dailyHeartrate.day),
  ]);

  const preOvTemps = baselineTemp
    .map((r) => r.tempDev!)
    .filter((_, i) => i < 14);
  const preOvHrs = baselineHr
    .map((r) => r.restingBpm!)
    .filter((_, i) => i < 14);

  if (preOvTemps.length < 5) return [];

  const baselineTempMean = preOvTemps.reduce((a, b) => a + b, 0) / preOvTemps.length;
  const baselineHrMean = preOvHrs.length > 0
    ? preOvHrs.reduce((a, b) => a + b, 0) / preOvHrs.length
    : null;

  let consecutiveElevatedTemp = 0;
  let maxConsecutiveTemp = 0;
  for (const row of tempData) {
    if (row.tempDev! > baselineTempMean + 0.15) {
      consecutiveElevatedTemp++;
      maxConsecutiveTemp = Math.max(maxConsecutiveTemp, consecutiveElevatedTemp);
    } else {
      consecutiveElevatedTemp = 0;
    }
  }

  let consecutiveElevatedHr = 0;
  let maxConsecutiveHr = 0;
  if (baselineHrMean) {
    for (const row of hrData) {
      if (row.restingBpm! > baselineHrMean + 3) {
        consecutiveElevatedHr++;
        maxConsecutiveHr = Math.max(maxConsecutiveHr, consecutiveElevatedHr);
      } else {
        consecutiveElevatedHr = 0;
      }
    }
  }

  const indicators: string[] = [];
  let confidence = 0;

  if (maxConsecutiveTemp >= 18) {
    confidence += 0.45;
    indicators.push(`Temperature elevated ${maxConsecutiveTemp} consecutive days post-ovulation`);
  } else if (maxConsecutiveTemp >= 14) {
    confidence += 0.35;
    indicators.push(`Temperature elevated ${maxConsecutiveTemp} consecutive days post-ovulation`);
  } else if (maxConsecutiveTemp >= 10) {
    confidence += 0.15;
    indicators.push(`Temperature elevated ${maxConsecutiveTemp} consecutive days post-ovulation`);
  } else {
    return [];
  }

  if (maxConsecutiveHr >= 14) {
    confidence += 0.3;
    indicators.push(`Resting HR elevated ${maxConsecutiveHr} consecutive days (+${baselineHrMean ? Math.round(hrData[hrData.length - 1]?.restingBpm! - baselineHrMean) : "?"}bpm above baseline)`);
  } else if (maxConsecutiveHr >= 7) {
    confidence += 0.15;
    indicators.push(`Resting HR elevated ${maxConsecutiveHr} consecutive days`);
  }

  const expectedPeriod = latestWithOvulation.nextPeriodDay;
  if (expectedPeriod && todayStr > expectedPeriod) {
    const daysLate = differenceInDays(todayDate, parseISO(expectedPeriod));
    if (daysLate >= 3) {
      confidence += 0.2;
      indicators.push(`Period ${daysLate} days late (expected ${expectedPeriod})`);
    }
  }

  confidence = Math.min(confidence, 1);

  if (confidence < 0.2) return [];

  return [{
    day: todayStr,
    signalType: "early_pregnancy",
    status: "detected",
    confidence,
    indicators,
    summary: confidence >= 0.6
      ? "Sustained post-ovulation temperature and HR elevation — consider taking a pregnancy test"
      : "Extended luteal phase detected — monitoring for possible pregnancy indicators",
    details: `${maxConsecutiveTemp} days elevated temp, ${maxConsecutiveHr} days elevated HR, ${daysSinceOv} days post-ovulation`,
  }];
}

async function detectAcuteIllness(
  todayStr: string,
  todayDate: Date
): Promise<HealthSignal[]> {
  const baselineCutoff = format(subDays(todayDate, 21), "yyyy-MM-dd");
  const recentCutoff = format(subDays(todayDate, 2), "yyyy-MM-dd");

  const [hrData, tempData, hrvData, spo2Data] = await Promise.all([
    db
      .select({ day: dailyHeartrate.day, restingBpm: dailyHeartrate.restingBpm })
      .from(dailyHeartrate)
      .where(and(gte(dailyHeartrate.day, baselineCutoff), isNotNull(dailyHeartrate.restingBpm)))
      .orderBy(dailyHeartrate.day),
    db
      .select({ day: dailyReadiness.day, tempDev: dailyReadiness.temperatureDeviation })
      .from(dailyReadiness)
      .where(and(gte(dailyReadiness.day, baselineCutoff), isNotNull(dailyReadiness.temperatureDeviation)))
      .orderBy(dailyReadiness.day),
    db
      .select({ day: sleepPeriods.day, hrv: sleepPeriods.averageHrv })
      .from(sleepPeriods)
      .where(and(gte(sleepPeriods.day, baselineCutoff), isNotNull(sleepPeriods.averageHrv), eq(sleepPeriods.type, "long_sleep")))
      .orderBy(sleepPeriods.day),
    db
      .select({ day: dailySpo2.day, spo2: dailySpo2.averageSpo2 })
      .from(dailySpo2)
      .where(and(gte(dailySpo2.day, baselineCutoff), isNotNull(dailySpo2.averageSpo2)))
      .orderBy(dailySpo2.day),
  ]);

  if (hrData.length < 10) return [];

  const baselineHr = hrData.filter((r) => r.day < recentCutoff);
  const recentHr = hrData.filter((r) => r.day >= recentCutoff);
  if (baselineHr.length < 7 || recentHr.length === 0) return [];

  const hrVals = baselineHr.map((r) => r.restingBpm!);
  const hrMean = hrVals.reduce((a, b) => a + b, 0) / hrVals.length;
  const hrSd = Math.sqrt(hrVals.reduce((a, b) => a + (b - hrMean) ** 2, 0) / hrVals.length);

  const baselineHrv = hrvData.filter((r) => r.day < recentCutoff);
  const recentHrv = hrvData.filter((r) => r.day >= recentCutoff);
  const hrvMean = baselineHrv.length > 0
    ? baselineHrv.map((r) => r.hrv!).reduce((a, b) => a + b, 0) / baselineHrv.length
    : null;

  const baselineTemp = tempData.filter((r) => r.day < recentCutoff);
  const recentTemp = tempData.filter((r) => r.day >= recentCutoff);
  const tempMean = baselineTemp.length > 0
    ? baselineTemp.map((r) => r.tempDev!).reduce((a, b) => a + b, 0) / baselineTemp.length
    : null;

  const signals: HealthSignal[] = [];

  for (const day of recentHr) {
    const indicators: string[] = [];
    let confidence = 0;

    const hrZ = hrSd > 0 ? (day.restingBpm! - hrMean) / hrSd : 0;
    if (hrZ > 2) {
      confidence += 0.4;
      indicators.push(`Resting HR ${Math.round(day.restingBpm!)} bpm (${hrZ.toFixed(1)} SD above baseline ${Math.round(hrMean)})`);
    } else {
      continue;
    }

    const dayHrv = recentHrv.find((r) => r.day === day.day)
      ?? hrvData.find((r) => r.day === format(subDays(new Date(day.day + "T12:00:00"), 1), "yyyy-MM-dd"));
    if (dayHrv && hrvMean) {
      const hrvDrop = (hrvMean - dayHrv.hrv!) / hrvMean;
      if (hrvDrop > 0.15) {
        confidence += 0.25;
        const label = dayHrv.day !== day.day ? ` (from ${dayHrv.day} sleep)` : "";
        indicators.push(`HRV dropped ${Math.round(hrvDrop * 100)}% (${Math.round(dayHrv.hrv!)} vs baseline ${Math.round(hrvMean)})${label}`);
      }
    }

    const dayTemp = recentTemp.find((r) => r.day === day.day);
    if (dayTemp && tempMean != null) {
      const tempElev = dayTemp.tempDev! - tempMean;
      if (tempElev > 0.2) {
        confidence += 0.2;
        indicators.push(`Temperature +${tempElev.toFixed(2)}°C above baseline`);
      }
    }

    const daySpo2 = spo2Data.find((r) => r.day === day.day);
    if (daySpo2 && daySpo2.spo2! < 95) {
      confidence += 0.15;
      indicators.push(`SpO2 ${daySpo2.spo2!}% (below 95% threshold)`);
    }

    confidence = Math.min(confidence, 1);
    if (confidence < 0.4) continue;

    signals.push({
      day: day.day,
      signalType: "acute_illness",
      status: "detected",
      confidence,
      indicators,
      summary: confidence >= 0.7
        ? "Multiple physiological signs suggest possible illness — monitor symptoms"
        : "Elevated resting heart rate with supporting indicators — possible illness onset",
      details: `HR z-score: ${hrZ.toFixed(1)}, indicators: ${indicators.length}`,
    });
  }

  return signals;
}

async function detectCycleIrregularity(
  todayStr: string,
  todayDate: Date
): Promise<HealthSignal[]> {
  const cycles = await db
    .select()
    .from(cyclePredictions)
    .orderBy(desc(cyclePredictions.cycleNumber))
    .limit(12);

  if (cycles.length < 3) return [];

  const signals: HealthSignal[] = [];

  const validLengths = cycles
    .map((c) => c.cycleLength)
    .filter((l): l is number => l != null && l >= 20 && l <= 50);

  if (validLengths.length >= 3) {
    const mean = validLengths.reduce((a, b) => a + b, 0) / validLengths.length;
    const sd = Math.sqrt(validLengths.reduce((a, b) => a + (b - mean) ** 2, 0) / validLengths.length);

    const latest = cycles[0];
    if (latest.cycleLength != null && sd > 0) {
      const zScore = Math.abs(latest.cycleLength - mean) / sd;
      if (zScore > 2) {
        const indicators = [
          `Latest cycle: ${latest.cycleLength} days (mean: ${Math.round(mean)}, SD: ${sd.toFixed(1)})`,
          `Deviation: ${zScore.toFixed(1)} standard deviations from average`,
        ];
        signals.push({
          day: todayStr,
          signalType: "cycle_irregularity",
          status: "detected",
          confidence: Math.min(zScore / 4, 1),
          indicators,
          summary: `Cycle length (${latest.cycleLength} days) is significantly different from your average (${Math.round(mean)} days)`,
          details: `z-score: ${zScore.toFixed(1)}, cycle: ${latest.cycleLength}d, mean: ${mean.toFixed(1)}d`,
        });
      }
    }
  }

  const latest = cycles[0];
  if (latest.nextPeriodDay && todayStr > latest.nextPeriodDay) {
    const daysLate = differenceInDays(todayDate, parseISO(latest.nextPeriodDay));
    if (daysLate >= 7) {
      const indicators = [
        `Period is ${daysLate} days late (expected ${latest.nextPeriodDay})`,
      ];
      const confidence = Math.min(daysLate / 21, 1);

      const existing = signals.find((s) => s.signalType === "cycle_irregularity");
      if (existing) {
        existing.indicators.push(...indicators);
        existing.confidence = Math.min(Math.max(existing.confidence, confidence), 1);
        existing.summary += ` Period is ${daysLate} days late.`;
      } else {
        signals.push({
          day: todayStr,
          signalType: "cycle_irregularity",
          status: "detected",
          confidence,
          indicators,
          summary: `Period is ${daysLate} days overdue`,
          details: `${daysLate} days past expected date ${latest.nextPeriodDay}`,
        });
      }
    }
  }

  return signals;
}
