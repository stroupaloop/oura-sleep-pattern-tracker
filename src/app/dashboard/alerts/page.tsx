export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { episodeAssessments, dailyAnalysis } from "@/lib/db/schema";
import { desc, ne } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnalyzeButton } from "./analyze-button";
import { EpisodeTimeline } from "@/components/charts/episode-timeline";
import { RESEARCH_REFERENCES } from "@/lib/research/references";
import type { AlertResearchContext } from "@/lib/analysis/episode";

const tierConfig = {
  alert: {
    border: "border-l-red-500",
    badge: "bg-red-500/20 text-red-300",
    label: "Alert",
  },
  warning: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/20 text-amber-300",
    label: "Warning",
  },
  watch: {
    border: "border-l-blue-500",
    badge: "bg-blue-500/20 text-blue-300",
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

function ResearchContextCard({ ctx, day }: { ctx: AlertResearchContext; day: string }) {
  const refs = RESEARCH_REFERENCES.filter((r) =>
    ctx.researchIds.includes(r.id)
  );
  const topRef = refs[0];

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{ctx.headline}</p>

      {ctx.whatWeDetected.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            What we detected
          </p>
          <ul className="text-sm space-y-1">
            {ctx.whatWeDetected.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">&bull;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topRef && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Why this matters
          </p>
          <p className="text-sm">{ctx.whyItMatters}</p>
          <a
            href={topRef.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block"
          >
            &mdash; {topRef.authors}, {topRef.journal}, {topRef.year} &rarr;
          </a>
        </div>
      )}

      {ctx.whatYouCanDo.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            What you can do
          </p>
          <ul className="text-sm space-y-1">
            {ctx.whatYouCanDo.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">&bull;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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

  const timelineAnalysis = allAnalysis.map((a) => ({
    day: a.day,
    anomalyScore: a.anomalyScore,
    isAnomaly: a.isAnomaly,
    anomalyDirection: a.anomalyDirection,
  }));

  const timelineEpisodes = allEpisodes.map((e) => ({
    day: e.day,
    tier: e.tier,
    direction: e.direction,
    confidence: e.confidence,
    primaryDrivers: e.primaryDrivers,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">
            {allAnalysis.length} days analyzed, {episodes.length} episode
            {episodes.length !== 1 ? "s" : ""} detected
          </p>
        </div>
        <AnalyzeButton />
      </div>

      {allAnalysis.length > 0 && (
        <EpisodeTimeline
          analysisData={timelineAnalysis}
          episodes={timelineEpisodes}
        />
      )}

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
            <p className="text-green-400 font-medium">
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

        let researchCtx: AlertResearchContext | null = null;
        try {
          researchCtx = ep.researchContext
            ? JSON.parse(ep.researchContext)
            : null;
        } catch {
          researchCtx = null;
        }

        return (
          <Card key={ep.day} className={`border-l-4 ${cfg.border}`}>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-lg">{ep.day}</CardTitle>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ep.direction && (
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${
                        ep.direction === "hypo"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-amber-500/20 text-amber-300"
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
            </CardHeader>
            <CardContent className="space-y-4">
              {researchCtx ? (
                <ResearchContextCard ctx={researchCtx} day={ep.day} />
              ) : (
                <>
                  <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
                </>
              )}

              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer">
                  Technical details
                </summary>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                  <div>Confidence: {ep.confidence?.toFixed(1)}/10</div>
                  {ep.bestWindowDays && (
                    <div>Window: {ep.bestWindowDays} days</div>
                  )}
                  {ep.consecutiveConcerningDays != null && (
                    <div>Consecutive days: {ep.consecutiveConcerningDays}</div>
                  )}
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
                  {drivers.length > 0 && (
                    <div className="col-span-2">
                      Drivers: {drivers.join(", ")}
                    </div>
                  )}
                </div>
              </details>

              {(ep.confounderLikelihood ?? 0) > 0.2 && (
                <p className="text-xs text-muted-foreground">
                  Confounder likelihood:{" "}
                  {((ep.confounderLikelihood ?? 0) * 100).toFixed(0)}%
                </p>
              )}

              <p className="text-xs text-muted-foreground border-t pt-3 mt-3">
                This tool tracks patterns for personal awareness. It is not a
                medical device and does not provide diagnoses.
              </p>
            </CardContent>
          </Card>
        );
      })}

      {episodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Research References</CardTitle>
            <CardDescription>
              Studies informing the detection algorithms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {RESEARCH_REFERENCES.map((r) => (
                <div key={r.id} className="text-xs space-y-0.5">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 font-medium"
                  >
                    {r.title}
                  </a>
                  <p className="text-muted-foreground">
                    {r.authors} &middot; {r.journal}, {r.year}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
