import { NextRequest, NextResponse } from "next/server";
import { syncDateRange } from "@/lib/oura/sync";
import { format, subDays } from "date-fns";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const startDate = format(subDays(today, 2), "yyyy-MM-dd");
  const endDate = format(today, "yyyy-MM-dd");

  try {
    const result = await syncDateRange(startDate, endDate, "cron");
    return NextResponse.json({
      success: true,
      records: result.records,
      startDate,
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
