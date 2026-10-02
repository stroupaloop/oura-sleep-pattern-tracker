import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { dailyReadiness, dailySleep } from "@/lib/db/schema";
import { Panel } from "./panel";

type SleepScoreRow = typeof dailySleep.$inferSelect;
type ReadinessRow = typeof dailyReadiness.$inferSelect;

/** Oura's own bands for its scores. */
export function scoreBand(score: number): {
  label: string;
  text: string;
  fill: string;
} {
  if (score >= 85) return { label: "Optimal", text: "text-calm", fill: "bg-calm" };
  if (score >= 70) return { label: "Good", text: "text-calm", fill: "bg-calm/70" };
  if (score >= 60) return { label: "Fair", text: "text-attention", fill: "bg-attention" };
  return { label: "Pay attention", text: "text-alert", fill: "bg-alert" };
}

function ScoreFigure({ label, score }: { label: string; score: number | null }) {
  const band = score != null ? scoreBand(score) : null;
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {score ?? "--"}
        </span>
        {band && (
          <span className={cn("text-sm font-medium", band.text)}>
            {band.label}
          </span>
        )}
      </p>
    </div>
  );
}

function Contributors({
  title,
  items,
}: {
  title: string;
  items: Array<{ name: string; score: number | null }>;
}) {
  const present = items.filter(
    (item): item is { name: string; score: number } => item.score != null
  );
  if (present.length === 0) return null;
  return (
    <div>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-2 space-y-2">
        {present.map((item) => {
          const band = scoreBand(item.score);
          return (
            <li
              key={item.name}
              className="grid grid-cols-[7.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm"
            >
              <span className="truncate text-muted-foreground">{item.name}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn("block h-full rounded-full", band.fill)}
                  style={{ width: `${Math.min(Math.max(item.score, 0), 100)}%` }}
                />
              </span>
              <span className="text-right tabular-nums">{item.score}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Oura's sleep and readiness scores for the night shown, with what fed them. */
export function ScorePanel({
  sleep,
  readiness,
  nightLabel,
  className,
}: {
  sleep: SleepScoreRow | null;
  readiness: ReadinessRow | null;
  nightLabel: string | null;
  className?: string;
}) {
  return (
    <Panel
      id="oura-scores"
      title="Oura scores"
      meta={nightLabel ?? undefined}
      className={className}
    >
      <div className="grid grid-cols-2 gap-4">
        <ScoreFigure label="Sleep" score={sleep?.score ?? null} />
        <ScoreFigure label="Readiness" score={readiness?.score ?? null} />
      </div>
      {(sleep || readiness) && (
        <details className="group mt-4 border-t pt-3">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            What went into them
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="mt-3 grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            <Contributors
              title="Sleep"
              items={[
                { name: "Deep sleep", score: sleep?.contributorDeepSleep ?? null },
                { name: "Efficiency", score: sleep?.contributorEfficiency ?? null },
                { name: "Latency", score: sleep?.contributorLatency ?? null },
                { name: "REM sleep", score: sleep?.contributorRemSleep ?? null },
                { name: "Restfulness", score: sleep?.contributorRestfulness ?? null },
                { name: "Timing", score: sleep?.contributorTiming ?? null },
                { name: "Total sleep", score: sleep?.contributorTotalSleep ?? null },
              ]}
            />
            <Contributors
              title="Readiness"
              items={[
                { name: "Activity balance", score: readiness?.contributorActivityBalance ?? null },
                { name: "Body temperature", score: readiness?.contributorBodyTemperature ?? null },
                { name: "HRV balance", score: readiness?.contributorHrvBalance ?? null },
                { name: "Previous day", score: readiness?.contributorPreviousDayActivity ?? null },
                { name: "Previous night", score: readiness?.contributorPreviousNight ?? null },
                { name: "Recovery index", score: readiness?.contributorRecoveryIndex ?? null },
                { name: "Resting heart rate", score: readiness?.contributorRestingHeartRate ?? null },
                { name: "Sleep balance", score: readiness?.contributorSleepBalance ?? null },
              ]}
            />
          </div>
        </details>
      )}
    </Panel>
  );
}
