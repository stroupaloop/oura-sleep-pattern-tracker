import { NextRequest, NextResponse } from "next/server";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";
import { notifyOuraConnectionFailure } from "@/lib/notifications/oura-connection-notify";
import { runOuraSyncPipeline } from "@/lib/oura/sync-pipeline";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const endDate = getTodayET();
  const startDate = format(
    subDays(new Date(`${endDate}T12:00:00`), 6),
    "yyyy-MM-dd"
  );

  try {
    const result = await runOuraSyncPipeline({
      startDate,
      endDate,
      syncType: "cron",
      includePrivate: true,
      recompute: "window",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Cron sync error:", error);
    await notifyOuraConnectionFailure();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
