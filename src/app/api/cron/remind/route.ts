import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSettings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { loadDailyLog } from "@/lib/daily-log-data";
import { summarizeDoses } from "@/lib/dose-summary";
import { buildReminder, dueSlotsAt } from "@/lib/reminder-content";
import { sendEmail } from "@/lib/notifications/email";
import { sendSms } from "@/lib/notifications/sms";
import { getTodayET } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getTodayET();

  const currentEtHour = parseInt(
    new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }),
    10
  );

  try {
    const log = await loadDailyLog(today);
    const { notTaken } = summarizeDoses(
      log.medications,
      log.medLogs,
      today,
      dueSlotsAt(currentEtHour)
    );
    const appUrl = process.env.NEXTAUTH_URL ?? "https://your-app.vercel.app";
    const checkinUrl = `${appUrl}/dashboard/checkin`;
    const reminder = buildReminder(notTaken, log.mood !== null, checkinUrl);

    if (!reminder) {
      return NextResponse.json({ skipped: true, reason: "Meds and check-in already logged" });
    }

    const recipients = await db
      .select()
      .from(notificationSettings)
      .where(
        and(
          eq(notificationSettings.enabled, 1),
          eq(notificationSettings.reminderHour, currentEtHour)
        )
      );

    if (recipients.length === 0) {
      return NextResponse.json({ skipped: true, reason: "No enabled recipients for current hour", currentEtHour });
    }

    const results: { type: string; destination: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      try {
        if (recipient.type === "email") {
          await sendEmail(recipient.destination, reminder.subject, reminder.html, {
            text: reminder.text,
          });
          results.push({ type: "email", destination: recipient.destination, success: true });
        } else if (recipient.type === "sms") {
          await sendSms(recipient.destination, reminder.sms);
          results.push({ type: "sms", destination: recipient.destination, success: true });
        }
      } catch (error) {
        results.push({
          type: recipient.type,
          destination: recipient.destination,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      console.error("Remind cron send failures:", JSON.stringify(failed));
    }
    console.log(
      `Remind cron: hour=${currentEtHour} missing=${notTaken.length} sent=${results.length - failed.length} failed=${failed.length}`
    );
    return NextResponse.json(
      { success: failed.length === 0, results },
      { status: failed.length === 0 ? 200 : 502 }
    );
  } catch (error) {
    console.error("Remind cron error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
