import { cn } from "@/lib/utils";
import type { NightStage, NightWindow } from "@/lib/health/night-window";

export const STAGE_STYLES: Record<
  NightStage,
  { label: string; className: string }
> = {
  deep: { label: "Deep", className: "bg-stage-deep" },
  light: { label: "Light", className: "bg-stage-light" },
  rem: { label: "REM", className: "bg-stage-rem" },
  awake: { label: "Awake", className: "bg-stage-awake" },
  asleep: { label: "Asleep", className: "bg-muted-foreground/60" },
};

const LEGEND_STAGES: NightStage[] = ["deep", "light", "rem", "awake"];

function percent(minutes: number, span: number): string {
  return `${(Math.min(Math.max(minutes, 0), span) / span) * 100}%`;
}

/**
 * The night drawn on the clock, under the window she usually sleeps in, so a
 * late, short or broken night reads at a glance before any number does.
 */
export function NightWindowChart({ window }: { window: NightWindow }) {
  const { span, usual } = window;
  const at = (minutes: number) => percent(minutes, span);
  const nightWidth = Math.max(window.wake - window.bedtime, 1);

  return (
    <figure className="space-y-3">
      <div aria-hidden="true" className="relative pt-1">
        {window.ticks.map((tick) => (
          <div
            key={tick.at}
            className="absolute top-0 bottom-6 w-px bg-border"
            style={{ left: at(tick.at) }}
          />
        ))}

        <div className="relative h-2">
          {usual && (
            <div
              className="absolute inset-y-0 rounded-full bg-corridor ring-1 ring-inset ring-border"
              style={{
                left: at(usual.bedtime),
                width: at(usual.wake - usual.bedtime),
              }}
            />
          )}
        </div>

        <div className="relative mt-2 h-7">
          <div
            className="absolute inset-y-0 overflow-hidden rounded-md bg-muted"
            style={{ left: at(window.bedtime), width: at(nightWidth) }}
          >
            {window.segments.map((segment) => (
              <div
                key={`${segment.start}-${segment.stage}`}
                className={cn(
                  "absolute inset-y-0",
                  STAGE_STYLES[segment.stage].className
                )}
                style={{
                  left: percent(segment.start - window.bedtime, nightWidth),
                  width: percent(segment.end - segment.start, nightWidth),
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative mt-2 h-4 text-[11px] leading-4 text-muted-foreground tabular-nums">
          {window.ticks.map((tick) => {
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
        <span className="sr-only">
          Asleep from {window.bedtimeLabel} to {window.wakeLabel}.
          {usual ? " The shaded band above is the usual sleep window." : ""}
        </span>
        {LEGEND_STAGES.map((stage) => (
          <span key={stage} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn("size-2.5 rounded-sm", STAGE_STYLES[stage].className)}
            />
            {STAGE_STYLES[stage].label}
          </span>
        ))}
        {usual && (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="h-2 w-4 rounded-full bg-corridor ring-1 ring-inset ring-border"
            />
            Usual window
          </span>
        )}
      </figcaption>
    </figure>
  );
}
