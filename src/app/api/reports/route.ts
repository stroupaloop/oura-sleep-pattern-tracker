import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/reports/generate";
import { format, subDays } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const endDate = searchParams.get("end") ?? format(new Date(), "yyyy-MM-dd");
    const startDate = searchParams.get("start") ?? format(subDays(new Date(), 30), "yyyy-MM-dd");

    const report = await generateReport(startDate, endDate);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
