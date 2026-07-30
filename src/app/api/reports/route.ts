import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/reports/generate";
import { format, subDays } from "date-fns";
import { requireApiUser, unauthorizedResponse } from "@/lib/api-auth";
import { getTodayET } from "@/lib/date-utils";

export async function GET(req: NextRequest) {
  const user = await requireApiUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(req.url);
    const endDate = searchParams.get("end") ?? getTodayET();
    const startDate =
      searchParams.get("start") ??
      format(subDays(new Date(`${endDate}T12:00:00`), 29), "yyyy-MM-dd");

    const report = await generateReport(startDate, endDate);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
