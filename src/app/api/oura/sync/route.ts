import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncDateRange } from "@/lib/oura/sync";
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
    return NextResponse.json(result);
  } catch (error) {
    console.error("Manual sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
