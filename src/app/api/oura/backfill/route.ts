import { NextRequest, NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { syncDateRange, syncSensitiveDateRange } from "@/lib/oura/sync";
import { runCyclePredictions } from "@/lib/analysis/cycle";
import { format, subDays } from "date-fns";

export async function POST(request: NextRequest) {
  const cronAuth = request.headers.get("authorization");
  const isCron = process.env.CRON_SECRET && cronAuth === `Bearer ${process.env.CRON_SECRET}`;
  let userEmail: string | null | undefined = null;
  if (!isCron) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userEmail = session.user.email;
  }

  const body = await request.json().catch(() => ({}));
  const days = Math.min(Number(body.days) || 90, 365);

  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

  try {
    const result = await syncDateRange(startDate, endDate, "backfill");

    let sensitiveRecords = 0;
    let cyclesDetected = 0;
    if (isCron || isSensitiveUser(userEmail)) {
      const sensitiveResult = await syncSensitiveDateRange(startDate, endDate, "backfill")
        .catch((err) => { console.error("Sensitive backfill (non-fatal):", err); return { records: 0 }; });
      sensitiveRecords = sensitiveResult.records;

      const cycleResult = await runCyclePredictions().catch((err) => {
        console.error("Cycle prediction (non-fatal):", err);
        return { cyclesDetected: 0 };
      });
      cyclesDetected = cycleResult.cyclesDetected;
    }

    return NextResponse.json({
      startDate,
      endDate,
      ...result,
      sensitiveRecords,
      cyclesDetected,
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        startDate,
        endDate,
      },
      { status: 500 }
    );
  }
}
