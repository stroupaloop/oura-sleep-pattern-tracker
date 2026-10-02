import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/dashboard-metrics";
import { formatMinutes, type Signal } from "@/lib/health/signals";
import { HypnogramChart } from "@/components/charts/hypnogram-chart";
import { STAGE_STYLES } from "@/components/health/night-window-chart";
import { SignalGauge } from "@/components/health/signal-list";
import { Pill } from "@/components/ui/pill";

export interface NightData {
  id: string;
  day: string;
  bedtimeStart: string;
  bedtimeEnd: string;
  totalSleepDuration: number | null;
  deepSleepDuration: number | null;
  lightSleepDuration: number | null;
  remSleepDuration: number | null;
  efficiency: number | null;
  latency: number | null;
  restlessPeriods: number | null;
  averageHeartRate: number | null;
  lowestHeartRate: number | null;
  averageHrv: number | null;
  temperatureDelta: number | null;
  hypnogram5min: string | null;
  hr5min: string | null;
}

export interface AnalysisData {
  hrvZScore: number;
  sleepDurationZScore: number;
  efficiencyZScore: number;
  isAnomaly: boolean;
  anomalyDirection: string | null;
  /** The night against her usual range, from the pattern checks' baselines. */
  sleep: Signal | null;
  efficiency: Signal | null;
  latency: Signal | null;
}

function pct(part: number | null, total: number | null): string {
  if (part == null || total == null || total === 0) return "--";
  return `${Math.round((part / total) * 100)}%`;
}

/** A measure, and where it sits against her usual range when there is one. */
function Measure({
  label,
  value,
  signal,
  threshold,
}: {
  label: string;
  value: React.ReactNode;
  signal?: Signal | null;
  threshold: number;
}) {
  const unusual = signal?.level === "unusual";
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <p className="text-muted-foreground">{label}</p>
        {unusual && <Pill tone="attention">Unusual</Pill>}
      </div>
      <p className="text-lg font-medium tabular-nums">{value}</p>
      {signal && (
        <>
          <p
            className={cn(
              "mt-0.5",
              unusual ? "text-attention" : "text-muted-foreground"
            )}
          >
            {signal.comparison}
            {signal.usualValue && signal.comparison !== "About usual" && (
              <span className="text-faint-foreground">
                {" "}
                · usual {signal.usualValue}
              </span>
            )}
          </p>
          <div className="mt-1.5 w-full max-w-32">
            <SignalGauge z={signal.z} threshold={threshold} unusual={unusual} />
          </div>
        </>
      )}
    </div>
  );
}

function MetricNote({ note }: { note: string }) {
  return <p className="text-xs text-attention">{note}</p>;
}

export function NightCardContent({
  night,
  analysis,
  threshold,
}: {
  night: NightData;
  analysis?: AnalysisData;
  /** The pattern checks' daily threshold, in standard deviations. */
  threshold: number;
}) {
  const latencyMin = night.latency != null ? night.latency / 60 : null;
  const hasComparison = !!(
    analysis?.sleep ||
    analysis?.efficiency ||
    analysis?.latency
  );
  const pastThreshold = (z: number) => Math.abs(z) >= threshold;

  const notes =
    analysis?.isAnomaly
      ? [
          pastThreshold(analysis.hrvZScore) &&
            `HRV is well ${analysis.hrvZScore < 0 ? "below" : "above"} your personal baseline. HRV is nonspecific and can change with recovery, stress, illness, alcohol, and other factors.`,
          pastThreshold(analysis.sleepDurationZScore) &&
            `Sleep duration is well ${analysis.sleepDurationZScore < 0 ? "below" : "above"} your personal baseline. Wearable sleep duration alone cannot identify a mood episode.`,
          pastThreshold(analysis.efficiencyZScore) &&
            `Sleep efficiency is well ${analysis.efficiencyZScore < 0 ? "below" : "above"} your personal baseline. Consider the pattern alongside symptoms and other context.`,
        ].filter((note): note is string => !!note)
      : [];

  const stages = [
    { style: STAGE_STYLES.deep, seconds: night.deepSleepDuration },
    { style: STAGE_STYLES.rem, seconds: night.remSleepDuration },
    { style: STAGE_STYLES.light, seconds: night.lightSleepDuration },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 md:gap-4">
        <Measure
          label="Total Sleep"
          value={formatDuration(night.totalSleepDuration)}
          signal={analysis?.sleep}
          threshold={threshold}
        />
        <Measure
          label="Efficiency"
          value={night.efficiency != null ? `${night.efficiency}%` : "--"}
          signal={analysis?.efficiency}
          threshold={threshold}
        />
        <Measure
          label="Time to fall asleep"
          value={latencyMin != null ? formatMinutes(latencyMin) : "--"}
          signal={analysis?.latency}
          threshold={threshold}
        />
        <Measure
          label="Restless"
          value={night.restlessPeriods ?? "--"}
          threshold={threshold}
        />
      </div>

      {hasComparison && (
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className="mt-1 h-2 w-6 shrink-0 rounded-full bg-corridor"
          />
          <span>
            Shaded: the usual range over the past 30 nights. Ticks: where the
            pattern checks count a night as unusual.
          </span>
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 sm:gap-4">
        {stages.map(({ style, seconds }) => (
          <div key={style.label}>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn("size-2.5 rounded-sm", style.className)}
              />
              {style.label}
            </p>
            <p className="font-medium tabular-nums">
              {formatDuration(seconds)}{" "}
              <span className="text-muted-foreground">
                ({pct(seconds, night.totalSleepDuration)})
              </span>
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 sm:gap-4">
        <div>
          <p className="text-muted-foreground">Avg HR</p>
          <p className="font-medium tabular-nums">
            {night.averageHeartRate?.toFixed(0) ?? "--"} bpm
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Lowest HR</p>
          <p className="font-medium tabular-nums">
            {night.lowestHeartRate ?? "--"} bpm
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">HRV</p>
          <p className="font-medium tabular-nums">
            {night.averageHrv?.toFixed(0) ?? "--"} ms
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Night Temp Deviation</p>
          <p className="font-medium tabular-nums">
            {night.temperatureDelta != null
              ? `${night.temperatureDelta > 0 ? "+" : ""}${night.temperatureDelta.toFixed(2)} °C`
              : "--"}
          </p>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="mt-3 space-y-1 border-t pt-3">
          {notes.map((note) => (
            <MetricNote key={note} note={note} />
          ))}
        </div>
      )}

      {night.hypnogram5min && (
        <details className="group mt-4 border-t pt-3">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span>
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>{" "}
              sleep stages
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="mt-3">
            <HypnogramChart
              hypnogram={night.hypnogram5min}
              hr5min={night.hr5min}
              bedtimeStart={night.bedtimeStart}
            />
          </div>
        </details>
      )}
    </>
  );
}
