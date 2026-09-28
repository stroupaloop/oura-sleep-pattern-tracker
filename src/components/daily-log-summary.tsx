import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EPISODE_STATES } from "@/lib/episode-states";
import { summarizeDoses } from "@/lib/dose-summary";
import { parseMoodTags } from "@/lib/mood-tags";
import type { DailyLog } from "@/lib/daily-log-data";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}

/**
 * The author's read-only view of the day's log. The log is hers to write, so
 * this never offers controls, and it leaves the note itself on the full log.
 */
export function DailyLogSummary({
  day,
  mood,
  medications,
  medLogs,
}: { day: string } & DailyLog) {
  const doses = summarizeDoses(medications, medLogs, day);
  const tags = parseMoodTags(mood?.tags);
  const episode =
    EPISODE_STATES.find((state) => state.value === mood?.episodeState)
      ?.label ?? "Not set";
  const moodLabel = mood
    ? mood.moodScore > 0
      ? `+${mood.moodScore}`
      : `${mood.moodScore}`
    : "Not logged yet";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Her day</CardTitle>
        <CardDescription>Today&apos;s daily log, read-only</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <dl className="space-y-1.5">
          <Row label="Mood" value={moodLabel} />
          {mood && <Row label="Episode" value={episode} />}
          <Row
            label="Taken"
            value={doses.taken.join(", ") || "None marked"}
          />
          {doses.notTaken.length > 0 && (
            <Row label="Not marked" value={doses.notTaken.join(", ")} />
          )}
          {mood && tags.length > 0 && (
            <Row
              label="Tags"
              value={tags.map((tag) => tag.replace(/_/g, " ")).join(", ")}
            />
          )}
          {mood?.notes?.trim() && <Row label="Note" value="Added" />}
        </dl>
        <Link
          href="/dashboard/health"
          className="inline-block text-xs text-muted-foreground underline hover:text-foreground"
        >
          Open the full log
        </Link>
      </CardContent>
    </Card>
  );
}
