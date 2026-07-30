import { NextRequest, NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { syncDateRange, syncSensitiveDateRange } from "@/lib/oura/sync";
import { runCyclePredictions } from "@/lib/analysis/cycle";
import { runHealthSignalDetection } from "@/lib/analysis/health-signals";
import { reprocessAll } from "@/lib/analysis/reprocess";
import { loadActiveConfig, loadBipolarType } from "@/lib/analysis/config";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";

export async function POST(request: NextRequest) {
  const cronAuth = request.headers.get("authorization");
  const isCron = process.env.CRON_SECRET && cronAuth === `Bearer ${process.env.CRON_SECRET}`;
  let userEmail: string | null | undefined = null;
  if (!isCron) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isSensitiveUser(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    userEmail = session.user.email;
  }

  const body = await request.json().catch(() => ({}));
  const days = Math.min(Number(body.days) || 90, 365);

  const endDate = getTodayET();
  const startDate = format(
    subDays(new Date(`${endDate}T12:00:00`), days - 1),
    "yyyy-MM-dd"
  );

  try {
    const result = await syncDateRange(startDate, endDate, "backfill");

    let sensitiveRecords = 0;
    let cyclesDetected = 0;
    const warnings = [...result.warnings];
    const canProcessSensitive = Boolean(isCron || isSensitiveUser(userEmail));
    if (canProcessSensitive) {
      const sensitiveResult = await syncSensitiveDateRange(
        startDate,
        endDate,
        "backfill"
      );
      sensitiveRecords = sensitiveResult.records;
      warnings.push(...sensitiveResult.warnings);

      const cycleResult = await runCyclePredictions();
      cyclesDetected = cycleResult.cyclesDetected;
    }

    const [config, bipolarType] = await Promise.all([
      loadActiveConfig(),
      loadBipolarType(),
    ]);
    const analysis = await reprocessAll(
      config,
      startDate,
      endDate,
      bipolarType
    );
    const healthSignals = canProcessSensitive
      ? (await runHealthSignalDetection()).signals
      : 0;

    return NextResponse.json({
      startDate,
      endDate,
      ...result,
      status: warnings.length > 0 ? "partial" : "success",
      warnings,
      sensitiveRecords,
      cyclesDetected,
      analysis,
      healthSignals,
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
