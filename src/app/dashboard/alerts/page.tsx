export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { episodeAssessments, dailyAnalysis } from "@/lib/db/schema";
import { desc, and, ne, eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnalyzeButton } from "./analyze-button";

const tierConfig = {
  alert: {
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-800",
    label: "Alert",
  },
  warning: {
    border: "border-l-amber-500",
    badge: "bg-amber-100 text-amber-800",
    label: "Warning",
  },
  watch: {
    border: "border-l-blue-500",
    badge: "bg-blue-100 text-blue-800",
    label: "Watch",
  },
} as const;

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, (value / 10) * 100);
  const color =
    value >= 5 ? "bg-red-500" : value >= 3.5 ? "bg-amber-500" : "bg-blue-500";
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default async function AlertsPage() {
  const episodes = await db
    .select()
    .from(episodeAssessments)
    .where(ne(episodeAssessments.tier, "none"))
    .orderBy(desc(episodeAssessments.day));

  const allEpisodes = await db
    .select()
    .from(episodeAssessments)
    .orderBy(desc(episodeAssessments.day));

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
            {allAnalysis.length} days analyzed, {episodes.length} episode
            {episodes.length !== 1 ? "s" : ""} detected
          </p>
        </div>
        <AnalyzeButton />
      </div>

      {episodes.length === 0 && allAnalysis.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No analysis has been run yet. Click &quot;Run Analysis&quot; to
              analyze your sleep data for patterns.
            </p>
          </CardContent>
        </Card>
      )}

      {episodes.length === 0 && allAnalysis.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-green-600 font-medium">
              No concerning patterns detected. Your sleep patterns appear stable.
            </p>
          </CardContent>
        </Card>
      )}

      {episodes.map((ep) => {
        const cfg =
          tierConfig[ep.tier as keyof typeof tierConfig] ?? tierConfig.watch;
        let drivers: string[] = [];
        try {
          drivers = JSON.parse(ep.primaryDrivers ?? "[]");
        } catch {
          drivers = [];
        }

        return (
          <Card key={ep.day} className={`border-l-4 ${cfg.border}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{ep.day}</CardTitle>
                <div className="flex items-center gap-2">
                  {ep.direction && (
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        ep.direction === "hypo"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ep.direction === "hypo"
                        ? "Depressive pattern"
                        : "Hypomanic pattern"}
                    </span>
                  )}
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${cfg.badge}`}
                  >
                    {cfg.label}
                  </span>
                </div>
              </div>
              <CardDescription className="flex items-center gap-2">
                <span>Confidence: {ep.confidence?.toFixed(1)}/10</span>
                {ep.consecutiveConcerningDays != null && (
                  <span>
                    &middot; {ep.consecutiveConcerningDays} consecutive day
                    {ep.consecutiveConcerningDays !== 1 ? "s" : ""}
                  </span>
                )}
                {ep.bestWindowDays && (
                  <span>&middot; {ep.bestWindowDays}-day window</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ConfidenceBar value={ep.confidence ?? 0} />

              {ep.summary && <p className="text-sm">{ep.summary}</p>}

              {drivers.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {drivers.map((d, i) => (
                    <span
                      key={i}
                      className="text-xs bg-muted px-2 py-1 rounded"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}

              {(ep.confounderLikelihood ?? 0) > 0.2 && (
                <p className="text-xs text-muted-foreground">
                  Confounder likelihood:{" "}
                  {((ep.confounderLikelihood ?? 0) * 100).toFixed(0)}%
                  {ep.bounceBackScore != null &&
                    ` (bounce-back: ${ep.bounceBackScore.toFixed(2)})`}
                </p>
              )}

              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer">
                  Advanced details
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
                  {ep.trendSlope != null && (
                    <div>Trend slope: {ep.trendSlope.toFixed(3)}</div>
                  )}
                  {ep.consistencyRatio != null && (
                    <div>
                      Consistency: {(ep.consistencyRatio * 100).toFixed(0)}%
                    </div>
                  )}
                  {ep.directionConsistency != null && (
                    <div>
                      Direction consistency:{" "}
                      {(ep.directionConsistency * 100).toFixed(0)}%
                    </div>
                  )}
                  {ep.latencyCV != null && (
                    <div>Latency CV: {ep.latencyCV.toFixed(3)}</div>
                  )}
                  {ep.temperatureMean != null && (
                    <div>
                      Temp mean: {ep.temperatureMean.toFixed(2)}&deg;
                      {ep.temperatureElevated === 1 && " (elevated)"}
                    </div>
                  )}
                </div>
              </details>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
