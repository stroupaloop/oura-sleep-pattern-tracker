export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth, isSensitiveUser } from "@/lib/auth";
import { loadDailyLog } from "@/lib/daily-log-data";
import { getTodayET } from "@/lib/date-utils";
import { currentEtHour } from "@/lib/health/format";
import { loadHealthDashboard } from "@/lib/health/health-dashboard-data";
import { shouldShowOuraConnectionProblem } from "@/lib/oura/connection-health";
import { Button } from "@/components/ui/button";
import { HealthDashboard } from "@/components/health/health-dashboard";

export default async function HealthPage() {
  const [session, data, dailyLog] = await Promise.all([
    auth(),
    loadHealthDashboard(),
    loadDailyLog(getTodayET()),
  ]);

  if (!data) {
    return (
      <div className="mx-auto mt-16 max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
        <p className="text-muted-foreground">
          Connect the Oura Ring to start tracking sleep and daily rhythm
          against a personal baseline.
        </p>
        <Button asChild>
          <Link href="/dashboard/settings#oura">Connect Oura Ring</Link>
        </Button>
      </div>
    );
  }

  return (
    <HealthDashboard
      data={data}
      dailyLog={dailyLog}
      canSync={isSensitiveUser(session?.user?.email)}
      paused={
        data.connection
          ? shouldShowOuraConnectionProblem(data.connection)
          : false
      }
      morning={currentEtHour() < 12}
    />
  );
}
