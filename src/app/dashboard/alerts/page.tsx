export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import {
  dailyAnalysis,
  dailyMood,
  episodeAssessments,
} from "@/lib/db/schema";
import { desc } from "drizzle-orm";
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
import { normalizeEvidenceScore } from "@/lib/analysis/window";
import {
  loadActiveConfig,
  loadBipolarType,
  type BipolarType,
} from "@/lib/analysis/config";
import {
  filterCurrentPatternAssessments,
  PATTERN_ALGORITHM_VERSION,
  PATTERN_SIGNAL_MODE,
} from "@/lib/analysis/provenance";
import {
  evaluateRetrospectiveAgreement,
  type RetrospectiveAgreement,
} from "@/lib/analysis/retrospective";

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

function EvidenceBar({
  value,
  tier,
}: {
  value: number;
  tier: string;
}) {
  const pct = Math.min(100, (value / 10) * 100);
  const color =
    tier === "alert"
      ? "bg-red-500"
      : tier === "warning"
        ? "bg-amber-500"
        : "bg-blue-500";
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`h-2 rounded-full ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function profileLabel(type: BipolarType): string {
  if (type === "bp1") return "Bipolar I";
  if (type === "bp2") return "Bipolar II";
  return "Default";
}

function formatEvaluatedAt(timestamp: number | null): string | null {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(timestamp * 1000));
}

function RetrospectiveAgreementCard({
  agreement,
}: {
  agreement: RetrospectiveAgreement;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Retrospective Agreement</CardTitle>
        <CardDescription>
          Compares wearable-only flags with separately logged episode-state
          check-ins. This is not clinical accuracy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {agreement.explicitLabelDays === 0 ? (
          <p className="text-sm text-muted-foreground">
            No episode-state check-ins are available for comparison. Optional
            check-ins remain separate from scoring.
          </p>
        ) : agreement.labelledEvents === 0 ? (
          <p className="text-sm text-muted-foreground">
            {agreement.explicitLabelDays} day
            {agreement.explicitLabelDays === 1 ? " has" : "s have"} an explicit
            episode-state check-in, but none form a depressive, hypomanic,
            manic, or mixed event for comparison.
          </p>
        ) : agreement.evaluableEvents === 0 ? (
          <p className="text-sm text-muted-foreground">
            {agreement.labelledEvents} labelled event
            {agreement.labelledEvents === 1 ? "" : "s"}, but none yet have the
            required {agreement.minimumCoverageDays} assessed days from the{" "}
            {agreement.lookbackDays} days before through the first labelled day.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xl font-semibold">
                  {agreement.eventsWithMatchingFlag}/
                  {agreement.evaluableEvents}
                </p>
                <p className="text-xs text-muted-foreground">
                  events with a matching flag
                </p>
              </div>
              <div>
                <p className="text-xl font-semibold">
                  {agreement.missedEvents}
                </p>
                <p className="text-xs text-muted-foreground">
                  labelled events without a matching flag
                </p>
              </div>
              <div>
                <p className="text-xl font-semibold">
                  {agreement.explicitLabelDays}
                </p>
                <p className="text-xs text-muted-foreground">
                  days with an explicit state check-in
                </p>
              </div>
              <div>
                <p className="text-xl font-semibold">
                  {agreement.medianLeadDays == null
                    ? "—"
                    : `${agreement.medianLeadDays}d`}
                </p>
                <p className="text-xs text-muted-foreground">
                  median lead time among matches
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              A non-None event is evaluable with at least{" "}
              {agreement.minimumCoverageDays} wearable assessment days from the{" "}
              {agreement.lookbackDays} days before through its first labelled
              day. A match requires a same-direction flag in that inclusive
              span; lead time is reported only among matched events.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ResearchContextCard({
  ctx,
  direction,
  consecutiveDays,
}: {
  ctx: AlertResearchContext;
  direction: string | null;
  consecutiveDays: number | null;
}) {
  const refs = RESEARCH_REFERENCES.filter((r) =>
    ctx.researchIds.includes(r.id)
  );
  const topRef = refs[0];

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">
        {consecutiveDays != null ? `${consecutiveDays}-day` : "Multi-day"}{" "}
        {direction === "hyper"
          ? "higher-activation"
          : direction === "hypo"
            ? "lower-activation"
            : "mixed"}{" "}
        pattern flag from the available data
      </p>

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
          <p className="text-sm">{topRef.finding}</p>
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
  const [allEpisodes, allAnalysis, moodRows, config, bipolarType] =
    await Promise.all([
      db
        .select()
        .from(episodeAssessments)
        .orderBy(desc(episodeAssessments.day)),
      db.select().from(dailyAnalysis).orderBy(desc(dailyAnalysis.day)),
      db
        .select({
          day: dailyMood.day,
          episodeState: dailyMood.episodeState,
        })
        .from(dailyMood)
        .orderBy(desc(dailyMood.day)),
      loadActiveConfig(),
      loadBipolarType(),
    ]);

  const currentAssessments = filterCurrentPatternAssessments(
    allEpisodes,
    config.version,
    bipolarType
  );
  const episodes = currentAssessments.filter(
    (assessment) => assessment.tier !== "none"
  );
  const labelledMood = moodRows.filter(
    (
      row
    ): row is {
      day: string;
      episodeState: string;
    } => row.episodeState !== null && row.episodeState !== "none"
  );
  const agreement = evaluateRetrospectiveAgreement(
    currentAssessments.map((assessment) => ({
      day: assessment.day,
      tier: assessment.tier,
      direction: assessment.direction,
      evaluable: assessment.bestWindowDays !== null,
    })),
    moodRows
  );
  const staleAssessmentCount =
    allEpisodes.length - currentAssessments.length;
  const latestAssessment = currentAssessments[0] ?? null;
  const latestEvaluatedAt = formatEvaluatedAt(
    latestAssessment?.evaluatedAt ?? null
  );

  const timelineEpisodes = currentAssessments.map((e) => ({
    day: e.day,
    tier: e.tier,
    direction: e.direction,
    confidence: normalizeEvidenceScore(e.confidence),
    primaryDrivers: e.primaryDrivers,
  }));
  const timelineSelfReports = labelledMood.map((row) => ({
    day: row.day,
    episodeState: row.episodeState,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Pattern Alerts</h1>
          <p className="text-muted-foreground">
            {currentAssessments.length} current days analyzed, {episodes.length}{" "}
            in-app pattern flag
            {episodes.length !== 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {profileLabel(bipolarType)} heuristic · config v{config.version} ·{" "}
            {PATTERN_SIGNAL_MODE} · algorithm {PATTERN_ALGORITHM_VERSION}
            {latestEvaluatedAt ? ` · updated ${latestEvaluatedAt}` : ""}
          </p>
        </div>
        <AnalyzeButton />
      </div>

      {staleAssessmentCount > 0 && (
        <Card className="border-amber-500/40">
          <CardContent className="pt-6">
            <p className="text-sm text-amber-200">
              {staleAssessmentCount} historical assessment
              {staleAssessmentCount === 1 ? " uses" : "s use"} an older
              profile, configuration, or algorithm. They are excluded here
              until &quot;Update all history&quot; recomputes the full history.
            </p>
          </CardContent>
        </Card>
      )}

      {currentAssessments.length > 0 && (
        <EpisodeTimeline
          episodes={timelineEpisodes}
          selfReports={timelineSelfReports}
          thresholds={{
            watch: config.watchMinConfidence,
            warning: config.warningMinConfidence,
            alert: config.alertMinConfidence,
          }}
        />
      )}

      <RetrospectiveAgreementCard agreement={agreement} />

      {allEpisodes.length === 0 && allAnalysis.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              No analysis has been run yet. Click &quot;Update all
              history&quot; to analyze your available wearable data for
              patterns.
            </p>
          </CardContent>
        </Card>
      )}

      {episodes.length === 0 && currentAssessments.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="font-medium">
              No sustained pattern flags from the available data. This is not a
              clinical assessment.
            </p>
          </CardContent>
        </Card>
      )}

      {episodes.map((storedEpisode) => {
        const ep = {
          ...storedEpisode,
          confidence: normalizeEvidenceScore(storedEpisode.confidence),
        };
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
                        ? "Lower-activation pattern"
                        : "Higher-activation pattern"}
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
                <ResearchContextCard
                  ctx={researchCtx}
                  direction={ep.direction}
                  consecutiveDays={ep.consecutiveConcerningDays}
                />
              ) : (
                <>
                  <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Evidence score: {ep.confidence?.toFixed(1)}/10</span>
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
                  <EvidenceBar
                    value={ep.confidence ?? 0}
                    tier={ep.tier}
                  />
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
                  <div>Evidence score: {ep.confidence?.toFixed(1)}/10</div>
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
                  Bounce-back index:{" "}
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
              Context only; these studies do not validate this app&apos;s
              algorithm.
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
