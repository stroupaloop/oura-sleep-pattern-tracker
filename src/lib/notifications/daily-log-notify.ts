import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyMood, medications, medicationLogs } from "@/lib/db/schema";
import { getAuthorEmail, isAuthorEmail } from "@/lib/access";
import { getTodayET } from "@/lib/date-utils";
import { summarizeDoses } from "@/lib/dose-summary";
import { parseMoodTags } from "@/lib/daily-log-format";
import { sendEmail } from "@/lib/notifications/email";
import {
  DAILY_LOG_QUIET_SECONDS,
  buildDailyLogAlert,
  dailyLogAlertsEnabled,
  isLatestLogSave,
} from "@/lib/notifications/daily-log-alert";

async function sendIfStillLatest(
  day: string,
  savedAt: number,
  email: string,
  recipient: string
) {
  await new Promise((resolve) =>
    setTimeout(resolve, DAILY_LOG_QUIET_SECONDS * 1000)
  );

  const [log] = await db
    .select()
    .from(dailyMood)
    .where(eq(dailyMood.day, day))
    .limit(1);
  if (!log || !isLatestLogSave(savedAt, log)) return;

  // Read at send time, so doses ticked off during the quiet period count.
  const [meds, doseLogs] = await Promise.all([
    db
      .select({
        id: medications.id,
        name: medications.name,
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
      .where(eq(medicationLogs.day, day)),
  ]);

  const alert = buildDailyLogAlert({
    email,
    day,
    today: getTodayET(),
    moodScore: log.moodScore,
    episodeState: log.episodeState,
    energyScore: log.energyScore,
    irritabilityScore: log.irritabilityScore,
    anxietyScore: log.anxietyScore,
    sleepSubjective: log.sleepSubjective,
    tags: parseMoodTags(log.tags),
    note: log.notes?.trim() || null,
    doses: summarizeDoses(meds, doseLogs, day),
    siteUrl: process.env.NEXTAUTH_URL ?? null,
  });
  await sendEmail(recipient, alert.subject, alert.html, { text: alert.text });
}

/**
 * Emails the author once a non-author's daily log has sat untouched for the
 * quiet period. Runs after the response, so saving never waits on it.
 */
export function queueDailyLogAlert(input: {
  day: string;
  savedAt: number;
  email: string | null | undefined;
}) {
  const enabled = dailyLogAlertsEnabled({
    flag: process.env.DAILY_LOG_ALERTS_ENABLED,
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  });
  const { email } = input;
  if (!enabled || !email || isAuthorEmail(email)) return;
  const recipient = process.env.VISIT_ALERT_TO ?? getAuthorEmail();
  if (!recipient) return;

  after(() =>
    sendIfStillLatest(input.day, input.savedAt, email, recipient).catch(
      (error) => {
        console.error("Failed to send daily log alert:", error);
      }
    )
  );
}
