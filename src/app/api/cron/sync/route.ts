import { NextRequest, NextResponse } from "next/server";
import { syncDateRange, syncSensitiveDateRange } from "@/lib/oura/sync";
import { reprocessAll } from "@/lib/analysis/reprocess";
import { runCyclePredictions } from "@/lib/analysis/cycle";
import { runHealthSignalDetection } from "@/lib/analysis/health-signals";
import { loadActiveConfig, loadBipolarType } from "@/lib/analysis/config";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const todayStr = getTodayET();
  const todayDate = new Date(todayStr + "T12:00:00");
  const syncStartDate = format(subDays(todayDate, 6), "yyyy-MM-dd");
  const analysisStartDate = syncStartDate;
  const endDate = todayStr;

  try {
    const syncResult = await syncDateRange(
      syncStartDate,
      endDate,
      "cron"
    );

    const sensitiveResult = await syncSensitiveDateRange(
      syncStartDate,
      endDate,
      "cron"
    );

    await runCyclePredictions();

    const config = await loadActiveConfig();
    const bipolarType = await loadBipolarType();
    const analysisResult = await reprocessAll(
      config,
      analysisStartDate,
      endDate,
      bipolarType
    );

    const healthResult = await runHealthSignalDetection();
    const warnings = [...syncResult.warnings, ...sensitiveResult.warnings];

    return NextResponse.json({
      success: true,
      status: warnings.length > 0 ? "partial" : "success",
      warnings,
      records: syncResult.records,
      sensitiveRecords: sensitiveResult.records,
      analysis: {
        startDate: analysisStartDate,
        endDate,
        daysProcessed: analysisResult.daysProcessed,
        episodes: analysisResult.episodes,
      },
      healthSignals: healthResult.signals,
      startDate: syncStartDate,
      endDate,
    });
  } catch (error) {
    console.error("Cron sync error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
