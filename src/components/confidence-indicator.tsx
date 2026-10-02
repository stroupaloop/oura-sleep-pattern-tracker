import Link from "next/link";
import { CircleSlash } from "lucide-react";
import type { DataAvailability } from "@/lib/analysis/confidence";
import type { OuraScope } from "@/lib/oura/contracts";
import { formatOuraScopeList } from "@/lib/oura/scope-labels";
import { Panel } from "@/components/ui/panel";

interface AvailabilityRowProps {
  label: string;
  value: string;
  latestDay: string | null;
  latestLabel: string;
}

function formatDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

function AvailabilityRow({
  label,
  value,
  latestDay,
  latestLabel,
}: AvailabilityRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-right text-sm tabular-nums">{value}</dd>
      <dd className="col-span-2 text-xs text-muted-foreground">
        {latestDay ? `${latestLabel}: ${formatDay(latestDay)}` : "No values in this window"}
      </dd>
    </div>
  );
}

function medicationLoggingValue(
  data: DataAvailability["medicationLogging"]
): string {
  if (data.entries > 0) {
    return `${data.entries} ${data.entries === 1 ? "entry" : "entries"} across ${data.loggedDays} ${data.loggedDays === 1 ? "day" : "days"}`;
  }
  if (data.activeMedications > 0) {
    return `${data.activeMedications} active ${data.activeMedications === 1 ? "medication" : "medications"} · no entries`;
  }
  return "Not configured";
}

export function DataAvailabilityCard({
  data,
  missingScopes = [],
  className,
}: {
  data: DataAvailability;
  /** Oura data the connection was not granted, named so the gap is visible. */
  missingScopes?: OuraScope[];
  className?: string;
}) {
  return (
    <Panel
      id="data-coverage"
      title="Data coverage"
      description={`Recorded values in the last ${data.windowDays} ET calendar days`}
      className={className}
    >
      <dl className="divide-y divide-border">
        <AvailabilityRow
          label="Sleep"
          value={`${data.sleep.measuredDays}/${data.windowDays} measured ${data.sleep.measuredDays === 1 ? "night" : "nights"}`}
          latestDay={data.sleep.latestDay}
          latestLabel="Latest ET sleep day"
        />
        <AvailabilityRow
          label="Activity classification"
          value={`${data.activity.measuredDays}/${data.windowDays} measured ${data.activity.measuredDays === 1 ? "day" : "days"}`}
          latestDay={data.activity.latestDay}
          latestLabel="Latest ET day with classified activity"
        />
        <AvailabilityRow
          label="Mood check-ins"
          value={`${data.mood.measuredDays}/${data.windowDays} ${data.mood.measuredDays === 1 ? "day" : "days"} logged`}
          latestDay={data.mood.latestDay}
          latestLabel="Latest check-in"
        />
        <AvailabilityRow
          label="Medication logging"
          value={medicationLoggingValue(data.medicationLogging)}
          latestDay={data.medicationLogging.latestDay}
          latestLabel="Latest medication log"
        />
      </dl>
      {missingScopes.length > 0 && (
        <div className="mt-4 flex gap-2.5 border-t pt-4">
          <CircleSlash
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-attention"
          />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              Not shared by Oura:
            </span>{" "}
            {formatOuraScopeList(missingScopes)}.{" "}
            <Link
              href="/dashboard/settings#oura"
              className="underline decoration-border hover:text-foreground"
            >
              How to turn them on
            </Link>
          </p>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Source-specific presence counts; a measured day may be partial. This
        is not an accuracy, adherence, or ring-wear score.
      </p>
    </Panel>
  );
}
