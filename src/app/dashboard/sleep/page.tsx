export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { sleepPeriods, dailySleep } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function pct(part: number | null, total: number | null): string {
  if (!part || !total || total === 0) return "--";
  return `${Math.round((part / total) * 100)}%`;
}

export default async function SleepPage() {
  const nights = await db
    .select()
    .from(sleepPeriods)
    .where(sql`${sleepPeriods.type} = 'long_sleep'`)
    .orderBy(desc(sleepPeriods.day))
    .limit(30);

  const scores = await db
    .select()
    .from(dailySleep)
    .orderBy(desc(dailySleep.day))
    .limit(30);

  const scoreMap = new Map(scores.map((s) => [s.day, s.score]));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Sleep Details</h1>
      <p className="text-muted-foreground">
        Nightly breakdown for the last {nights.length} nights
      </p>

      {nights.map((night) => (
        <Card key={night.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{night.day}</CardTitle>
              <span className="text-sm font-medium">
                Score: {scoreMap.get(night.day) ?? "--"}
              </span>
            </div>
            <CardDescription>
              {formatTime(night.bedtimeStart)} — {formatTime(night.bedtimeEnd)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Sleep</p>
                <p className="font-medium text-lg">
                  {formatDuration(night.totalSleepDuration)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Efficiency</p>
                <p className="font-medium text-lg">
                  {night.efficiency ? `${night.efficiency}%` : "--"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Latency</p>
                <p className="font-medium text-lg">
                  {night.latency ? `${Math.round(night.latency / 60)}min` : "--"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Restless</p>
                <p className="font-medium text-lg">
                  {night.restlessPeriods ?? "--"}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Deep</p>
                <p className="font-medium">
                  {formatDuration(night.deepSleepDuration)}{" "}
                  <span className="text-muted-foreground">
                    ({pct(night.deepSleepDuration, night.totalSleepDuration)})
                  </span>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">REM</p>
                <p className="font-medium">
                  {formatDuration(night.remSleepDuration)}{" "}
                  <span className="text-muted-foreground">
                    ({pct(night.remSleepDuration, night.totalSleepDuration)})
                  </span>
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Light</p>
                <p className="font-medium">
                  {formatDuration(night.lightSleepDuration)}{" "}
                  <span className="text-muted-foreground">
                    ({pct(night.lightSleepDuration, night.totalSleepDuration)})
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Avg HR</p>
                <p className="font-medium">
                  {night.averageHeartRate?.toFixed(0) ?? "--"} bpm
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Lowest HR</p>
                <p className="font-medium">
                  {night.lowestHeartRate ?? "--"} bpm
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">HRV</p>
                <p className="font-medium">
                  {night.averageHrv?.toFixed(0) ?? "--"} ms
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Temp Delta</p>
                <p className="font-medium">
                  {night.temperatureDelta != null
                    ? `${night.temperatureDelta > 0 ? "+" : ""}${night.temperatureDelta.toFixed(2)}°`
                    : "--"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
