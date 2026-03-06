import Link from "next/link";
import {
  RESEARCH_REFERENCES,
  OURA_LIMITATIONS,
  METRIC_LIMITATIONS,
} from "@/lib/research/references";

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Methodology</h1>
        <p className="text-muted-foreground text-sm mt-1">
          How we detect mood episode signals from wearable data
        </p>
      </div>

      {/* How It Works */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">How It Works</h2>
        <p className="text-sm text-muted-foreground">
          The detection system uses a 3-stage pipeline that runs daily after
          syncing your Oura Ring data.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4 space-y-2">
            <div className="text-sm font-medium">Stage 1: Daily Anomaly Detection</div>
            <p className="text-xs text-muted-foreground">
              Each day, 14+ metrics are compared against your personal 30-day
              trimmed-mean baseline. A weighted composite z-score identifies
              days that deviate significantly from your norm.
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
            <div className="text-sm font-medium">Stage 3: Episode Classification</div>
            <p className="text-xs text-muted-foreground">
              Based on confidence score and consecutive concerning days, each
              day is classified into a tier: none, watch, warning, or alert.
              Direction (hyper/hypo) is determined by which signals dominate.
            </p>
          </div>
        </div>
      </section>

      {/* Metrics We Track */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Metrics We Track</h2>
        <p className="text-sm text-muted-foreground">
          We compute and monitor 16+ metrics across six categories.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Sleep</div>
            <p className="text-xs text-muted-foreground">
              Duration, deep/REM/light stage percentages, efficiency, onset
              latency, restless periods, fragmentation index
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Heart</div>
            <p className="text-xs text-muted-foreground">
              Average HR, lowest HR, HRV (RMSSD), within-night HR variability
              (CV), within-night HRV variability (CV)
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Circadian</div>
            <p className="text-xs text-muted-foreground">
              Interdaily Stability (IS), Intradaily Variability (IV), Relative
              Amplitude (RA) &mdash; computed from 5-min activity data
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Temperature</div>
            <p className="text-xs text-muted-foreground">
              Skin temperature delta from baseline, temperature deviation from
              readiness data
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Activity</div>
            <p className="text-xs text-muted-foreground">
              Daily steps, active minutes, stress high periods, recovery high
              periods, resilience level
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Self-Report</div>
            <p className="text-xs text-muted-foreground">
              Mood score, energy level, irritability, anxiety &mdash; captured
              through daily check-ins
            </p>
          </div>
        </div>
      </section>

      {/* Research */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Research</h2>
        <p className="text-sm text-muted-foreground">
          Our detection approach is informed by peer-reviewed research on
          wearable biomarkers and bipolar disorder.
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
                {ref.authors} &middot; {ref.journal} ({ref.year})
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
                  <span className="font-mono text-muted-foreground">
                    {metric}
                  </span>
                  : {note}
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
          Detection thresholds are tuned based on two factors:
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Bipolar Type</div>
            <p className="text-xs text-muted-foreground">
              <strong>BP1:</strong> Higher weight on mania signals (sleep
              reduction, HRV spikes, temperature elevation). Tuned for
              detecting full manic episodes.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>BP2:</strong> Higher weight on depressive signals and
              subtle hypomania markers (circadian disruption, activity
              variability). Tuned for earlier detection of hypomanic shifts.
            </p>
          </div>
          <div className="rounded-lg border p-4 space-y-1">
            <div className="text-sm font-medium">Sensitivity Level</div>
            <p className="text-xs text-muted-foreground">
              <strong>Low:</strong> Fewer alerts, higher confidence required.
              Best if you prefer minimal notifications.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>Medium:</strong> Balanced detection. Recommended for most
              users.
            </p>
            <p className="text-xs text-muted-foreground">
              <strong>High:</strong> More sensitive, may flag subtle shifts
              earlier. Best for users who want maximum awareness.
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

      {/* Disclaimer */}
      <section className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
        <h2 className="text-sm font-semibold">Disclaimer</h2>
        <p className="text-xs text-muted-foreground">
          This tool is for personal awareness only. It is not a medical device,
          does not provide clinical diagnoses, and should not replace
          professional psychiatric care. The algorithms detect statistical
          patterns in wearable data &mdash; they cannot confirm or rule out
          mood episodes. Always discuss concerns with your healthcare provider.
        </p>
        <p className="text-xs text-muted-foreground">
          Research references are provided for transparency. Individual results
          may vary significantly from published study populations.
        </p>
      </section>
    </div>
  );
}
