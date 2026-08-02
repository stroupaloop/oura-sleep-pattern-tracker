import { NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { syncDateRange, syncSensitiveDateRange } from "@/lib/oura/sync";
import { runCyclePredictions } from "@/lib/analysis/cycle";
import { runHealthSignalDetection } from "@/lib/analysis/health-signals";
import { reprocessAll } from "@/lib/analysis/reprocess";
import { loadActiveConfig, loadBipolarType } from "@/lib/analysis/config";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSensitiveUser(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const endDate = getTodayET();
  const startDate = format(
    subDays(new Date(`${endDate}T12:00:00`), 6),
    "yyyy-MM-dd"
  );

  try {
    const result = await syncDateRange(startDate, endDate, "manual");

    let sensitiveRecords = 0;
    let cyclesDetected = 0;
    const warnings = [...result.warnings];
    const sensitiveResult = await syncSensitiveDateRange(
      startDate,
      endDate,
      "manual"
    );
    sensitiveRecords = sensitiveResult.records;
    warnings.push(...sensitiveResult.warnings);

    const cycleResult = await runCyclePredictions();
    cyclesDetected = cycleResult.cyclesDetected;

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
    const healthSignals = (
      await runHealthSignalDetection(cycleResult.evaluation)
    ).signals;

    return NextResponse.json({
      ...result,
      status: warnings.length > 0 ? "partial" : "success",
      warnings,
      sensitiveRecords,
      cyclesDetected,
      analysis,
      healthSignals,
    });
  } catch (error) {
    console.error("Manual sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
