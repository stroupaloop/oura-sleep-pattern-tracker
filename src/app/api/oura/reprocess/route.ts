import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadActiveConfig, loadBipolarType } from "@/lib/analysis/config";
import { reprocessAll } from "@/lib/analysis/reprocess";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { startDate, endDate } = body as {
      startDate?: string;
      endDate?: string;
    };

    const config = await loadActiveConfig();
    const bipolarType = await loadBipolarType();
    const result = await reprocessAll(config, startDate, endDate, bipolarType);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Reprocess error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
