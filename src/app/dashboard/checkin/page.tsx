export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  dailyMood,
  episodeAssessments,
  medications,
  medicationLogs,
} from "@/lib/db/schema";
import { desc, eq, gte } from "drizzle-orm";
import { MoodForm } from "./mood-form";
import { getTodayET, shiftIsoDay } from "@/lib/date-utils";
import { loadActiveConfig, loadBipolarType } from "@/lib/analysis/config";
import { filterCurrentPatternAssessments } from "@/lib/analysis/provenance";
import { summarizeEpisodePattern } from "@/lib/episode-pattern";
import { PageHeader } from "@/components/page-header";

export default async function CheckinPage() {
  const today = getTodayET();
  const fourteenDaysAgo = shiftIsoDay(today, -13) ?? today;

  const [
    existingMood,
    trackedMeds,
    todayMedLogs,
    patternConfig,
    bipolarType,
    recentAssessmentRows,
  ] = await Promise.all([
    db
      .select()
      .from(dailyMood)
      .where(eq(dailyMood.day, today))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        id: medications.id,
        name: medications.name,
        dosage: medications.dosage,
        frequency: medications.frequency,
        doseSchedule: medications.doseSchedule,
        startDate: medications.startDate,
        endDate: medications.endDate,
      })
      .from(medications)
      .orderBy(medications.name),
    db
      .select({
        medicationId: medicationLogs.medicationId,
        slot: medicationLogs.slot,
        taken: medicationLogs.taken,
      })
      .from(medicationLogs)
      .where(eq(medicationLogs.day, today)),
    loadActiveConfig(),
    loadBipolarType(),
    db
      .select({
        day: episodeAssessments.day,
        tier: episodeAssessments.tier,
        direction: episodeAssessments.direction,
        configVersion: episodeAssessments.configVersion,
        bipolarProfile: episodeAssessments.bipolarProfile,
        algorithmVersion: episodeAssessments.algorithmVersion,
        signalMode: episodeAssessments.signalMode,
      })
      .from(episodeAssessments)
      .where(gte(episodeAssessments.day, fourteenDaysAgo))
      .orderBy(desc(episodeAssessments.day)),
  ]);

  // Same assessments and summary as the Health tab, so the two never disagree.
  const episodePattern = summarizeEpisodePattern(
    filterCurrentPatternAssessments(
      recentAssessmentRows,
      patternConfig.version,
      bipolarType
    ),
    fourteenDaysAgo
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
      <PageHeader title="Daily Check-in" />
      <MoodForm
        initialDay={today}
        existingMood={existingMood}
        medications={trackedMeds}
        existingMedLogs={todayMedLogs}
        episodePattern={episodePattern}
      />
    </div>
  );
}
