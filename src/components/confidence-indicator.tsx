import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DataAvailability } from "@/lib/analysis/confidence";

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
    <div className="grid gap-x-4 gap-y-0.5 border-b pb-2 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_auto]">
      <dt className="text-sm font-medium">{label}</dt>
      <dd className="text-sm sm:text-right">{value}</dd>
      <dd className="text-xs text-muted-foreground sm:col-span-2">
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

export function DataAvailabilityCard({ data }: { data: DataAvailability }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Data Availability</CardTitle>
        <CardDescription>
          Recorded values in the last {data.windowDays} ET calendar days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-2">
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
        <p className="text-xs text-muted-foreground">
          Source-specific presence counts; a measured day may be partial. This
          is not an accuracy, adherence, or ring-wear score.
        </p>
      </CardContent>
    </Card>
  );
}
