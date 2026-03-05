export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { dailyAnalysis } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnalyzeButton } from "./analyze-button";

export default async function AlertsPage() {
  const anomalies = await db
    .select()
    .from(dailyAnalysis)
    .where(eq(dailyAnalysis.isAnomaly, 1))
    .orderBy(desc(dailyAnalysis.day));

  const allAnalysis = await db
    .select()
    .from(dailyAnalysis)
    .orderBy(desc(dailyAnalysis.day));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">
            {allAnalysis.length} days analyzed, {anomalies.length} anomalies
            detected
          </p>
        </div>
        <AnalyzeButton />
      </div>

      {anomalies.length === 0 && allAnalysis.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No analysis has been run yet. Click &quot;Run Analysis&quot; to
              analyze your sleep data for patterns.
            </p>
          </CardContent>
        </Card>
      )}

      {anomalies.length === 0 && allAnalysis.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-green-600 font-medium">
              No anomalies detected. Your sleep patterns appear stable.
            </p>
          </CardContent>
        </Card>
      )}

      {anomalies.map((a) => (
        <Card
          key={a.day}
          className={
            a.anomalyDirection === "hypo"
              ? "border-l-4 border-l-blue-500"
              : a.anomalyDirection === "hyper"
                ? "border-l-4 border-l-amber-500"
                : "border-l-4 border-l-yellow-500"
          }
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{a.day}</CardTitle>
              {a.anomalyDirection && (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    a.anomalyDirection === "hypo"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {a.anomalyDirection === "hypo"
                    ? "Possible depressive pattern"
                    : "Possible hypomanic pattern"}
                </span>
              )}
            </div>
            <CardDescription>
              Anomaly score: {a.anomalyScore?.toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {a.anomalyNotes && (
              <p className="text-sm mb-3">{a.anomalyNotes}</p>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Sleep</p>
                <p className="font-medium">
                  {a.totalSleepMinutes?.toFixed(0)}min
                  <span className="text-muted-foreground">
                    {" "}
                    (baseline: {a.baselineSleepMinutes?.toFixed(0)}min)
                  </span>
                </p>
                <p
                  className={`text-xs ${
                    Math.abs(a.sleepDurationZScore ?? 0) > 2
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  z = {a.sleepDurationZScore?.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">HRV</p>
                <p className="font-medium">
                  {a.avgHrv?.toFixed(0)}ms
                  <span className="text-muted-foreground">
                    {" "}
                    (baseline: {a.baselineHrv?.toFixed(0)}ms)
                  </span>
                </p>
                <p
                  className={`text-xs ${
                    Math.abs(a.hrvZScore ?? 0) > 2
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  z = {a.hrvZScore?.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Heart Rate</p>
                <p className="font-medium">
                  {a.avgHeartRate?.toFixed(0)}bpm
                  <span className="text-muted-foreground">
                    {" "}
                    (baseline: {a.baselineHeartRate?.toFixed(0)}bpm)
                  </span>
                </p>
                <p
                  className={`text-xs ${
                    Math.abs(a.heartRateZScore ?? 0) > 2
                      ? "text-red-500"
                      : "text-muted-foreground"
                  }`}
                >
                  z = {a.heartRateZScore?.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
