import Link from "next/link";
import { Info } from "lucide-react";
import {
  RESEARCH_REFERENCES,
  OURA_LIMITATIONS,
  METRIC_LIMITATIONS,
} from "@/lib/research/references";
import { PageHeader } from "@/components/page-header";
import { SupportLine } from "@/components/support-line";
import { Callout } from "@/components/ui/callout";
import {
  DEFAULT_ABSOLUTE_THRESHOLDS,
  SENSITIVITY_PRESETS,
  type MetricWeights,
} from "@/lib/analysis/config";
import {
  BASELINE_DAYS,
  BASELINE_GUARD_DAYS,
} from "@/lib/analysis/baseline-window";

const SCORED_MEASURES: Record<
  keyof MetricWeights,
  { category: string; label: string }
> = {
  sleepDuration: { category: "Sleep", label: "duration" },
  bedtimeShift: { category: "Sleep", label: "bedtime" },
  wakeTimeShift: { category: "Sleep", label: "wake time" },
  latency: { category: "Sleep", label: "onset latency" },
  restlessPeriods: { category: "Sleep", label: "restless periods" },
  sleepEfficiency: { category: "Sleep", label: "efficiency" },
  deepPct: { category: "Sleep", label: "deep-sleep percentage" },
  remPct: { category: "Sleep", label: "REM percentage" },
  heartRate: { category: "Heart", label: "average heart rate" },
  hrv: { category: "Heart", label: "HRV (RMSSD)" },
  withinNightVariability: {
    category: "Heart",
    label:
      "within-night variability (heart rate, HRV or sleep stages, whichever is furthest above your usual)",
  },
  circadianRegularity: {
    category: "Circadian",
    label: "Intradaily Variability (IV)",
  },
  temperatureDelta: {
    category: "Temperature",
    label: "temperature deviation from Oura's readiness data",
  },
  activityLevel: {
    category: "Activity",
    label: "daily steps (active minutes when steps are missing)",
  },
};

const SCORED_COUNT = Object.keys(SCORED_MEASURES).length;

const METRIC_CARDS = [
  { category: "Sleep", notScored: "light-sleep percentage" },
  { category: "Heart", notScored: "lowest heart rate" },
  {
    category: "Circadian",
    notScored:
      "Interdaily Stability (IS) and Relative Amplitude (RA), computed from 5-min activity data",
  },
  { category: "Temperature", notScored: null },
  {
    category: "Activity",
    notScored:
      "recovery-high minutes, high-stress minutes and resilience level (the last two are also read across several nights)",
  },
  {
    category: "Self-Report",
    notScored:
      "mood score, energy level, irritability and anxiety, captured through daily check-ins and retained as context and retrospective labels, not inputs to the pattern score",
  },
];

const FIXED_SLEEP_HOURS = DEFAULT_ABSOLUTE_THRESHOLDS.minSleepMinutes / 60;
const FIXED_EFFICIENCY = DEFAULT_ABSOLUTE_THRESHOLDS.minEfficiency;

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <PageHeader
        title="Methodology"
        description="How personal-baseline pattern flags are calculated"
      />

      {/* How It Works */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How It Works</h2>
        <p className="text-sm text-muted-foreground">
          The pattern-scoring system uses a 3-stage pipeline that runs daily after
          syncing your Oura Ring data.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="text-sm font-medium">Stage 1: Daily Anomaly Detection</div>
            <p className="text-xs text-muted-foreground">
              Each day, {SCORED_COUNT} measures are compared against your
              personal trimmed-mean baseline: the {BASELINE_DAYS} nights before
              the latest {BASELINE_GUARD_DAYS}, so a stretch of unusual nights
              is measured against how you were before it, not against itself.
              A weighted composite z-score identifies days that deviate
              significantly from your norm.
            </p>
            <p className="text-xs text-muted-foreground">
              Two fixed rules are added to that score and do not depend on your
              usual: a night under {FIXED_SLEEP_HOURS} hours adds 0.5, and
              sleep efficiency under {FIXED_EFFICIENCY}% adds 0.3. They are a
              backstop, so a very short or very broken night still counts when
              your own usual has slipped that low. On their own they cannot flag
              a night (the line is {SENSITIVITY_PRESETS.medium.dailyAnomalyThreshold}{" "}
              at Medium sensitivity). Both are rules of thumb chosen for this
              app, not validated cutoffs.
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <div className="text-sm font-medium">Stage 2: Multi-Day Window Analysis</div>
            <p className="text-xs text-muted-foreground">
              Sliding windows (3, 5, and 7 days) check for sustained trends.
              The system evaluates trend slope, consistency ratio, and
              directional consistency to distinguish noise from real shifts.
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <div className="text-sm font-medium">Stage 3: Pattern Flagging</div>
            <p className="text-xs text-muted-foreground">
              Based on a heuristic evidence score and consecutive flagged days, each
              day is classified into a tier: none, watch, warning, or alert.
              Higher- or lower-activation direction describes which inputs
              dominate; it does not identify a mood episode.
            </p>
            <p className="text-xs text-muted-foreground">
              A flag is lowered when the latest night has eased. The app
              compares the latest night&apos;s score with the highest score in
              the 3-, 5- or 7-night stretch that gave the strongest evidence.
              The evidence is reduced in proportion to the drop, and a drop of
              more than {percent(SENSITIVITY_PRESETS.medium.bounceBackThreshold)}{" "}
              of that peak at Medium sensitivity (
              {percent(SENSITIVITY_PRESETS.low.bounceBackThreshold)} at Low,{" "}
              {percent(SENSITIVITY_PRESETS.high.bounceBackThreshold)} at High)
              clears the flag completely, however strong the evidence was
              earlier in the stretch. Lower-activation patterns need a drop 20
              percentage points larger. This keeps a flag from lingering after a
              rough night has passed; it is a rule of thumb, not a validated
              cutoff.
            </p>
          </div>
        </div>
      </section>

      {/* Metrics We Track */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Metrics We Track</h2>
        <p className="text-sm text-muted-foreground">
          {SCORED_COUNT} measures are scored every night, each against your own
          usual. Measures listed as not scored are still stored and shown in
          the app, but they do not add to the nightly score.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {METRIC_CARDS.map((card) => {
            const scored = Object.values(SCORED_MEASURES)
              .filter((measure) => measure.category === card.category)
              .map((measure) => measure.label);
            return (
              <div
                key={card.category}
                className="rounded-lg border p-4 space-y-1"
              >
                <div className="text-sm font-medium">{card.category}</div>
                {scored.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Scored:</span>{" "}
                    {scored.join(", ")}
                  </p>
                )}
                {card.notScored && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Not scored:
                    </span>{" "}
                    {card.notScored}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Research */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Research</h2>
        <p className="text-sm text-muted-foreground">
          The feature selection is informed by peer-reviewed research on
          wearable measures and bipolar disorder. Those studies do not validate
          this app&apos;s combined score or thresholds.
        </p>

        <div className="space-y-3">
          {RESEARCH_REFERENCES.map((ref) => (
            <div key={ref.id} className="rounded-lg border p-4 space-y-1">
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline"
              >
                {ref.title}
              </a>
              <p className="text-xs text-muted-foreground">
                {ref.authors} · {ref.journal} ({ref.year})
              </p>
              <p className="text-xs text-muted-foreground">{ref.finding}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Limitations */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Limitations</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">
              What Oura Cannot Measure
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Missing Data</th>
                    <th className="text-left py-2 pr-4 font-medium">Impact</th>
                    <th className="text-left py-2 font-medium">Mitigation</th>
                  </tr>
                </thead>
                <tbody>
                  {OURA_LIMITATIONS.map((lim) => (
                    <tr key={lim.missing} className="border-b">
                      <td className="py-2 pr-4">{lim.missing}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {lim.impact}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {lim.mitigation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Metric-Specific Notes</h3>
            <div className="space-y-2">
              {Object.entries(METRIC_LIMITATIONS).map(([metric, note]) => (
                <div key={metric} className="text-xs">
                  <span className="font-medium">{metric}</span>
                  <span className="text-muted-foreground">: {note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sensitivity & Configuration */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Sensitivity &amp; Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Heuristic thresholds can be adjusted in two ways:
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Pattern Profile</div>
            <p className="text-xs text-muted-foreground">
              <strong>BP1 pattern profile:</strong> Uses the base daily metric
              weights and applies less bounce-back attenuation to
              higher-activation evidence. It is not validated to detect manic
              episodes.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>BP2 pattern profile:</strong> Gives more daily-score
              weight to exploratory within-night variability, slightly less to
              sleep duration, and applies the default higher-activation
              bounce-back attenuation. It is not a validated hypomania
              detector.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Not specified:</strong> Uses the base daily metric
              weights and default bounce-back attenuation.
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Sensitivity Level</div>
            <p className="text-xs text-muted-foreground">
              <strong>Low:</strong> Fewer flags, with more heuristic evidence
              required.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Medium:</strong> The app&apos;s default balance between
              sensitivity and noise.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>High:</strong> More flags and a greater chance of noise.
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          You can adjust these in{" "}
          <Link
            href="/dashboard/settings"
            className="underline hover:text-foreground"
          >
            Settings
          </Link>
          .
        </p>
      </section>

      <SupportLine />

      {/* Disclaimer */}
      <Callout tone="info" icon={Info}>
        <h2 className="mb-1 font-semibold text-foreground">Disclaimer</h2>
        <p>
          This tool is for personal awareness only. It is not a medical device,
          does not provide clinical diagnoses, and should not replace
          professional psychiatric care. The algorithms detect statistical
          patterns in wearable data &mdash; they cannot confirm or rule out
          mood episodes. Always discuss concerns with your healthcare provider.
        </p>
        <p className="mt-2">
          Research references are provided for transparency. Individual results
          may vary significantly from published study populations.
        </p>
      </Callout>
    </div>
  );
}
