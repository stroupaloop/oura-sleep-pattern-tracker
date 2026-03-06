import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationSettings, dailyMood } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { sendEmail } from "@/lib/notifications/email";
import { sendSms } from "@/lib/notifications/sms";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = format(new Date(), "yyyy-MM-dd");

  try {
    const existingMood = await db
      .select({ id: dailyMood.id })
      .from(dailyMood)
      .where(eq(dailyMood.day, today))
      .limit(1);

    if (existingMood.length > 0) {
      return NextResponse.json({ skipped: true, reason: "Already checked in today" });
    }

    const recipients = await db
      .select()
      .from(notificationSettings)
      .where(eq(notificationSettings.enabled, 1));

    if (recipients.length === 0) {
      return NextResponse.json({ skipped: true, reason: "No enabled recipients" });
    }

    const appUrl = process.env.NEXTAUTH_URL ?? "https://your-app.vercel.app";
    const checkinUrl = `${appUrl}/dashboard/checkin`;
    const results: { type: string; destination: string; success: boolean; error?: string }[] = [];

    for (const recipient of recipients) {
      try {
        if (recipient.type === "email") {
          await sendEmail(
            recipient.destination,
            "Time for your daily check-in",
            `<p>Hey! Don't forget your daily mood check-in.</p><p><a href="${checkinUrl}">Open Check-in</a></p>`
          );
          results.push({ type: "email", destination: recipient.destination, success: true });
        } else if (recipient.type === "sms") {
          await sendSms(
            recipient.destination,
            `Time for your daily check-in! ${checkinUrl}`
          );
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

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Remind cron error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
