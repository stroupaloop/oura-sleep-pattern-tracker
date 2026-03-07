import { NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { syncDateRange, syncSensitiveDateRange } from "@/lib/oura/sync";
import { runCyclePredictions } from "@/lib/analysis/cycle";
import { format, subDays } from "date-fns";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), 7), "yyyy-MM-dd");

  try {
    const result = await syncDateRange(startDate, endDate, "manual");

    let sensitiveRecords = 0;
    let cyclesDetected = 0;
    if (isSensitiveUser(session.user.email)) {
      const sensitiveResult = await syncSensitiveDateRange(startDate, endDate, "manual")
        .catch((err) => { console.error("Sensitive sync (non-fatal):", err); return { records: 0 }; });
      sensitiveRecords = sensitiveResult.records;

      const cycleResult = await runCyclePredictions().catch((err) => {
        console.error("Cycle prediction (non-fatal):", err);
        return { cyclesDetected: 0 };
      });
      cyclesDetected = cycleResult.cyclesDetected;
    }

    return NextResponse.json({ ...result, sensitiveRecords, cyclesDetected });
  } catch (error) {
    console.error("Manual sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
