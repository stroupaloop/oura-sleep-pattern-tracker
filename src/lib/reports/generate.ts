import { db } from "@/lib/db";
import {
  dailyAnalysis,
  dailyMood,
  episodeAssessments,
  medicationLogs,
  medications,
} from "@/lib/db/schema";
import { gte, lte, and, eq, ne, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface ReportData {
  dateRange: { start: string; end: string };
  summary: {
    totalDays: number;
    avgSleepHours: number;
    avgHrv: number;
    avgSteps: number;
    moodEntries: number;
    avgMood: number | null;
  };
  trends: {
    sleepTrend: "improving" | "worsening" | "stable";
    hrvTrend: "improving" | "worsening" | "stable";
  };
  episodes: {
    day: string;
    tier: string;
    direction: string | null;
    confidence: number;
    summary: string | null;
  }[];
  medicationAdherence: {
    name: string;
    taken: number;
    total: number;
    rate: number;
  }[];
  dataCompleteness: {
    ouraDays: number;
    moodDays: number;
    totalDays: number;
    ouraRate: number;
    moodRate: number;
  };
}

function computeTrend(values: number[]): "improving" | "worsening" | "stable" {
  if (values.length < 7) return "stable";
  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));
  const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const diff = (avg2 - avg1) / avg1;
  if (Math.abs(diff) < 0.05) return "stable";
  return diff > 0 ? "improving" : "worsening";
}

export async function generateReport(
  startDate: string,
  endDate: string
): Promise<ReportData> {
  const dateCondition = and(
    gte(dailyAnalysis.day, startDate),
    lte(dailyAnalysis.day, endDate)
  );

  const [analysisRows, moodRows, episodeRows, medRows, medLogRows] = await Promise.all([
    db
      .select({
        day: dailyAnalysis.day,
        totalSleepMinutes: dailyAnalysis.totalSleepMinutes,
        avgHrv: dailyAnalysis.avgHrv,
        steps: dailyAnalysis.steps,
      })
      .from(dailyAnalysis)
      .where(dateCondition)
      .orderBy(dailyAnalysis.day),
    db
      .select({ day: dailyMood.day, moodScore: dailyMood.moodScore })
      .from(dailyMood)
      .where(and(gte(dailyMood.day, startDate), lte(dailyMood.day, endDate)))
      .orderBy(dailyMood.day),
    db
      .select({
        day: episodeAssessments.day,
        tier: episodeAssessments.tier,
        direction: episodeAssessments.direction,
        confidence: episodeAssessments.confidence,
        summary: episodeAssessments.summary,
      })
      .from(episodeAssessments)
      .where(
        and(
          ne(episodeAssessments.tier, "none"),
          gte(episodeAssessments.day, startDate),
          lte(episodeAssessments.day, endDate)
        )
      )
      .orderBy(desc(episodeAssessments.day)),
    db.select().from(medications).where(eq(medications.isActive, 1)),
    db
      .select()
      .from(medicationLogs)
      .where(and(gte(medicationLogs.day, startDate), lte(medicationLogs.day, endDate))),
  ]);

  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;

  const sleepValues = analysisRows.filter((r) => r.totalSleepMinutes).map((r) => r.totalSleepMinutes!);
  const hrvValues = analysisRows.filter((r) => r.avgHrv).map((r) => r.avgHrv!);
  const stepValues = analysisRows.filter((r) => r.steps).map((r) => r.steps!);
  const moodValues = moodRows.map((r) => r.moodScore);

  const medAdherence = medRows.map((med) => {
    const logs = medLogRows.filter((l) => l.medicationId === med.id);
    const taken = logs.filter((l) => l.taken === 1).length;
    return {
      name: med.name,
      taken,
      total: logs.length,
      rate: logs.length > 0 ? taken / logs.length : 0,
    };
  });

  return {
    dateRange: { start: startDate, end: endDate },
    summary: {
      totalDays,
      avgSleepHours: sleepValues.length > 0
        ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length / 60
        : 0,
      avgHrv: hrvValues.length > 0
        ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length
        : 0,
      avgSteps: stepValues.length > 0
        ? Math.round(stepValues.reduce((a, b) => a + b, 0) / stepValues.length)
        : 0,
      moodEntries: moodValues.length,
      avgMood: moodValues.length > 0
        ? moodValues.reduce((a, b) => a + b, 0) / moodValues.length
        : null,
    },
    trends: {
      sleepTrend: computeTrend(sleepValues),
      hrvTrend: computeTrend(hrvValues),
    },
    episodes: episodeRows,
    medicationAdherence: medAdherence,
    dataCompleteness: {
      ouraDays: analysisRows.length,
      moodDays: moodRows.length,
      totalDays,
      ouraRate: totalDays > 0 ? analysisRows.length / totalDays : 0,
      moodRate: totalDays > 0 ? moodRows.length / totalDays : 0,
    },
  };
}
