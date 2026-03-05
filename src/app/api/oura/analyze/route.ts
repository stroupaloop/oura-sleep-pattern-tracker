import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { analyzeAllDays } from "@/lib/analysis/anomaly";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await analyzeAllDays();
    const anomalies = results.filter((r) => r.isAnomaly);
    return NextResponse.json({
      success: true,
      daysAnalyzed: results.length,
      anomaliesFound: anomalies.length,
      anomalies,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
