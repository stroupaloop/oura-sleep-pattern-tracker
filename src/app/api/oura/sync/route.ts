import { NextResponse } from "next/server";
import { auth, isSensitiveUser } from "@/lib/auth";
import { format, subDays } from "date-fns";
import { getTodayET } from "@/lib/date-utils";
import { runOuraSyncPipeline } from "@/lib/oura/sync-pipeline";

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
    return NextResponse.json(
      await runOuraSyncPipeline({
        startDate,
        endDate,
        syncType: "manual",
        includePrivate: true,
        recompute: "window",
      })
    );
  } catch (error) {
    console.error("Manual sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
