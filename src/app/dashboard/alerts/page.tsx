export const dynamic = "force-dynamic";

import Link from "next/link";
import { ChevronDown, History } from "lucide-react";
import { db } from "@/lib/db";
import {
  dailyAnalysis,
  dailyMood,
  episodeAssessments,
} from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { AnalyzeButton } from "./analyze-button";
import { AlertsCheckStatus } from "./check-status";
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
import { PageHeader } from "@/components/page-header";
import { PatternDirectionLabel } from "@/components/pattern-direction-label";
import { Callout } from "@/components/ui/callout";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Stat } from "@/components/ui/stat";
import { describePatternAdvice } from "@/lib/design/pattern-advice";
import { describePatternDirection } from "@/lib/design/pattern-direction";
import { tierColor, tierLabel, tierTone } from "@/lib/design/pattern-tiers";
import { formatNightLabel } from "@/lib/health/format";
import { getTodayET } from "@/lib/date-utils";

const RESEARCH_LINK =
  "text-primary underline decoration-primary/40 hover:decoration-primary";

function EvidenceBar({
  value,
  tier,
}: {
  value: number;
  tier: string;
}) {
  const pct = Math.min(100, (value / 10) * 100);
  return (
    <div aria-hidden="true" className="h-2 w-full rounded-full bg-muted">
      <div
        className="h-2 rounded-full"
        style={{ width: `${pct}%`, backgroundColor: tierColor(tier) }}
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

/** Both sides of the night, with the year when it is not this one. */
function flaggedNightLabel(day: string, currentYear: string): string {
  const label = formatNightLabel(day, { weekday: false });
  const year = day.slice(0, 4);
  return year === currentYear ? label : `${label}, ${year}`;
}

function RetrospectiveAgreementCard({
  agreement,
}: {
  agreement: RetrospectiveAgreement;
}) {
  return (
    <Panel
      id="retrospective-agreement"
      title="Retrospective Agreement"
      description="Compares wearable-only flags with separately logged episode-state check-ins. This is not clinical accuracy."
    >
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
            <Stat
              className="flex flex-col justify-between gap-1"
              label="Events with a matching flag"
              value={`${agreement.eventsWithMatchingFlag}/${agreement.evaluableEvents}`}
            />
            <Stat
              className="flex flex-col justify-between gap-1"
              label="Labelled events without a matching flag"
              value={agreement.missedEvents}
            />
            <Stat
              className="flex flex-col justify-between gap-1"
              label="Days with an explicit state check-in"
              value={agreement.explicitLabelDays}
            />
            <Stat
              className="flex flex-col justify-between gap-1"
              label="Median lead time among matches"
              value={
                agreement.medianLeadDays == null
                  ? "—"
                  : `${agreement.medianLeadDays}d`
              }
            />
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
    </Panel>
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
        {describePatternDirection(direction).adjective.toLowerCase()} pattern
        flag from the available data
      </p>

      {ctx.whatWeDetected.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">
            What we detected
          </h3>
          <ul className="text-sm space-y-1">
            {ctx.whatWeDetected.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topRef && (
        <div>
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">
            Why this matters
          </h3>
          <p className="text-sm">{topRef.finding}</p>
          <a
            href={topRef.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-1 inline-block text-xs ${RESEARCH_LINK}`}
          >
            — {topRef.authors}, {topRef.journal}, {topRef.year} →
          </a>
        </div>
      )}

      <div>
        <h3 className="mb-1 text-xs font-medium text-muted-foreground">
          What you can do
        </h3>
        <ul className="text-sm space-y-1">
          {describePatternAdvice(direction).map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
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
  const today = getTodayET();
  const currentYear = today.slice(0, 4);

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
      <PageHeader
        title="Pattern Alerts"
        description={
          <>
            {currentAssessments.length} current days analyzed, {episodes.length}{" "}
            in-app pattern flag
            {episodes.length !== 1 ? "s" : ""}
            <span className="mt-1 block text-xs">
              {profileLabel(bipolarType)} heuristic · config v{config.version} ·{" "}
              {PATTERN_SIGNAL_MODE} · algorithm {PATTERN_ALGORITHM_VERSION}
              {latestEvaluatedAt ? ` · updated ${latestEvaluatedAt}` : ""}
            </span>
          </>
        }
        actions={<AnalyzeButton />}
      />

      {staleAssessmentCount > 0 && (
        <Callout
          tone="attention"
          icon={History}
          title={`${staleAssessmentCount} older result${
            staleAssessmentCount === 1 ? " is" : "s are"
          } hidden`}
        >
          <p>
            {staleAssessmentCount === 1 ? "It was" : "They were"} computed by
            an older version of the pattern checks, or with an earlier profile
            or configuration, so {staleAssessmentCount === 1 ? "it stays" : "they stay"}{" "}
            hidden here until recomputed.{" "}
            <Link
              href="/dashboard/settings"
              className="font-medium text-foreground underline decoration-border hover:decoration-current"
            >
              Settings → Backfill
            </Link>{" "}
            recomputes all history, as does “Update all history”
            above.
          </p>
        </Callout>
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
        <EmptyState title="No analysis has been run yet">
          Click “Update all history” to analyze your available
          wearable data for patterns.
        </EmptyState>
      )}

      {episodes.length === 0 && latestAssessment && (
        <AlertsCheckStatus
          latestCheckedDay={latestAssessment.day}
          today={today}
        />
      )}

      {episodes.map((storedEpisode) => {
        const ep = {
          ...storedEpisode,
          confidence: normalizeEvidenceScore(storedEpisode.confidence),
        };
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
          <Panel
            key={ep.day}
            id={`flag-${ep.day}`}
            title={flaggedNightLabel(ep.day, currentYear)}
            meta={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {ep.direction && (
                  <PatternDirectionLabel
                    direction={ep.direction}
                    className="font-medium text-foreground"
                  />
                )}
                <Pill tone={tierTone(ep.tier)}>{tierLabel(ep.tier)}</Pill>
              </span>
            }
          >
            <div className="space-y-4">
              {researchCtx ? (
                <ResearchContextCard
                  ctx={researchCtx}
                  direction={ep.direction}
                  consecutiveDays={ep.consecutiveConcerningDays}
                />
              ) : (
                <>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground tabular-nums">
                    <span>Evidence score: {ep.confidence?.toFixed(1)}/10</span>
                    {ep.consecutiveConcerningDays != null && (
                      <span>
                        · {ep.consecutiveConcerningDays} consecutive day
                        {ep.consecutiveConcerningDays !== 1 ? "s" : ""}
                      </span>
                    )}
                    {ep.bestWindowDays && (
                      <span>· {ep.bestWindowDays}-day window</span>
                    )}
                  </p>
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

              <details className="group text-xs">
                <summary className="flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground sm:min-h-8 [&::-webkit-details-marker]:hidden">
                  Technical details
                  <ChevronDown
                    aria-hidden="true"
                    className="size-3.5 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground tabular-nums">
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
                      Temp mean: {ep.temperatureMean.toFixed(2)}°
                      {ep.temperatureElevated === 1 && " (elevated)"}
                    </div>
                  )}
                  {drivers.length > 0 && (
                    <div className="sm:col-span-2">
                      Drivers: {drivers.join(", ")}
                    </div>
                  )}
                </div>
              </details>

              {(ep.confounderLikelihood ?? 0) > 0.2 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  Bounce-back index:{" "}
                  {((ep.confounderLikelihood ?? 0) * 100).toFixed(0)}%
                </p>
              )}

              <p className="text-xs text-muted-foreground border-t pt-3 mt-3">
                This tool tracks patterns for personal awareness. It is not a
                medical device and does not provide diagnoses.
              </p>
            </div>
          </Panel>
        );
      })}

      {episodes.length > 0 && (
        <Panel
          id="research-references"
          title="Research References"
          description="Context only; these studies do not validate this app's algorithm."
        >
          <ul className="space-y-3">
            {RESEARCH_REFERENCES.map((r) => (
              <li key={r.id} className="space-y-0.5">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm font-medium ${RESEARCH_LINK}`}
                >
                  {r.title}
                </a>
                <p className="text-xs text-muted-foreground">
                  {r.authors} · {r.journal}, {r.year}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
