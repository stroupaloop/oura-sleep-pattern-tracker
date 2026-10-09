import { cn } from "@/lib/utils";
import type { NightStrip, NightStripRow } from "@/lib/health/night-strip";
import { shiftIsoDay } from "@/lib/date-utils";

function percent(minutes: number, span: number): string {
  return `${(Math.min(Math.max(minutes, 0), span) / span) * 100}%`;
}

/** "Wed night": the evening the night starts, since Oura dates it by the morning. */
export function stripNightLabel(day: string): string {
  const evening = shiftIsoDay(day, -1) ?? day;
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(`${evening}T12:00:00Z`));
  return `${weekday} night`;
}

function rowSummary(row: NightStripRow): string {
  if (!row.recorded) return `${stripNightLabel(row.day)}: no night recorded.`;
  return [
    `${stripNightLabel(row.day)}: asleep ${row.bedtimeLabel} to ${row.wakeLabel}`,
    row.asleep ? `${row.asleep} of sleep` : null,
    row.comparison ? row.comparison.toLowerCase() : null,
    row.level === "unusual" ? "unusual" : null,
  ]
    .filter(Boolean)
    .join(", ")
    .concat(".");
}

/**
 * The last nights on one clock, newest first, each under the window she usually
 * sleeps in: a night that came later, ran shorter or broke in two shows as a
 * bar that moves, shrinks or splits. A night with nothing recorded is one line
 * that says so, never a bar. Color only when a night's sleep crossed the
 * detector's threshold, and then in words too.
 */
export function NightStripChart({ strip }: { strip: NightStrip }) {
  const { span } = strip;
  const at = (minutes: number) => percent(minutes, span);

  return (
    <figure className="space-y-3">
      <div aria-hidden="true" className="space-y-2.5">
        {strip.rows.map((row) => (
          <StripRow key={row.day} row={row} strip={strip} />
        ))}

        <div className="relative h-4 text-[11px] leading-4 text-muted-foreground tabular-nums">
          {strip.ticks.map((tick) => {
            const share = tick.at / span;
            return (
              <span
                key={tick.at}
                className={cn(
                  "absolute whitespace-nowrap",
                  share < 0.06
                    ? "translate-x-0"
                    : share > 0.94
                      ? "-translate-x-full"
                      : "-translate-x-1/2"
                )}
                style={{ left: at(tick.at) }}
              >
                {tick.label}
              </span>
            );
          })}
        </div>
      </div>

      <figcaption className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <ul className="sr-only">
          {strip.rows.map((row) => (
            <li key={row.day}>{rowSummary(row)}</li>
          ))}
        </ul>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-4 rounded-sm bg-muted-foreground/60"
          />
          Asleep
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="h-2 w-4 rounded-full bg-corridor ring-1 ring-inset ring-border"
          />
          Usual window
        </span>
      </figcaption>
    </figure>
  );
}

function StripRow({ row, strip }: { row: NightStripRow; strip: NightStrip }) {
  const { span } = strip;
  const at = (minutes: number) => percent(minutes, span);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 tabular-nums">
        <span className="text-xs text-muted-foreground">
          {stripNightLabel(row.day)}
        </span>
        {row.recorded ? (
          <span className="text-right text-sm">
            <span className="font-medium">{row.asleep ?? "--"}</span>
            {row.comparison && (
              <span
                className={cn(
                  "text-xs",
                  row.level === "unusual"
                    ? "text-attention"
                    : "text-muted-foreground"
                )}
              >
                {" · "}
                {row.comparison}
              </span>
            )}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No night recorded</span>
        )}
      </div>

      {row.recorded && (
        <div className="relative h-6">
          {strip.ticks.map((tick) => (
            <div
              key={tick.at}
              className="absolute inset-y-0 w-px bg-border"
              style={{ left: at(tick.at) }}
            />
          ))}
          {row.usual && (
            <div
              className="absolute inset-y-0 rounded-full bg-corridor ring-1 ring-inset ring-border"
              style={{
                left: at(row.usual.start),
                width: at(row.usual.end - row.usual.start),
              }}
            />
          )}
          {row.bar?.stretches.map((stretch) => (
            <div
              key={stretch.start}
              className="absolute inset-y-[5px] rounded-md bg-muted-foreground/60"
              style={{
                left: at(stretch.start),
                width: at(Math.max(stretch.end - stretch.start, 1)),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
