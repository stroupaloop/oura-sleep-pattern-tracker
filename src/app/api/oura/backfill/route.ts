import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncDateRange } from "@/lib/oura/sync";
import { format, subDays } from "date-fns";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const days = Math.min(Number(body.days) || 90, 365);

  const endDate = format(new Date(), "yyyy-MM-dd");
  const startDate = format(subDays(new Date(), days), "yyyy-MM-dd");

  try {
    const result = await syncDateRange(startDate, endDate, "backfill");
    return NextResponse.json({
      startDate,
      endDate,
      ...result,
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
