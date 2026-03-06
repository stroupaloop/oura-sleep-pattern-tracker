import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadActiveConfig, loadBipolarType } from "@/lib/analysis/config";
import { reprocessAll } from "@/lib/analysis/reprocess";

export async function POST(request: NextRequest) {
  const cronAuth = request.headers.get("authorization");
  const isCron = process.env.CRON_SECRET && cronAuth === `Bearer ${process.env.CRON_SECRET}`;
  if (!isCron) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const config = await loadActiveConfig();
    const bipolarType = await loadBipolarType();
    const result = await reprocessAll(config, undefined, undefined, bipolarType);

    return NextResponse.json({
      success: true,
      daysAnalyzed: result.daysProcessed,
      episodes: result.episodes,
      processingTimeMs: result.processingTimeMs,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
