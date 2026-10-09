"use client";

import { Suspense, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  checkCustomRange,
  describeDateRange,
  withRange,
  type RangePreset,
  type ResolvedRange,
} from "@/lib/date-range";
import { cn } from "@/lib/utils";

const CUSTOM = "custom";

interface DateRangeSelectorProps {
  /** What the page resolved from its address, so the choice shown is the one in effect. */
  range: ResolvedRange;
  /** The presets this page offers, from `presetsFor`. */
  presets: readonly RangePreset[];
  /** App-time today: the latest end a custom range can have. */
  today: string;
  /** Said after the dates, e.g. "4 flagged nights". */
  detail?: React.ReactNode;
  className?: string;
}

function RangeSummary({
  range,
  detail,
  pending,
}: {
  range: ResolvedRange;
  detail?: React.ReactNode;
  pending?: boolean;
}) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "text-xs text-muted-foreground tabular-nums transition-opacity",
        pending && "opacity-60"
      )}
    >
      Showing {describeDateRange(range)}
      {detail ? <> · {detail}</> : null}
    </p>
  );
}

function Selector({
  range,
  presets,
  today,
  detail,
  className,
}: DateRangeSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(range.kind === "absolute");
  const [from, setFrom] = useState(range.start ?? "");
  const [to, setTo] = useState(range.end);
  const [error, setError] = useState<string | null>(null);

  const options = presets.map((preset) => ({
    value: preset.value,
    label: (
      <>
        <span aria-hidden="true">{preset.label}</span>
        <span className="sr-only">{preset.spoken}</span>
      </>
    ),
  }));
  // A range typed into the address that is not a preset (45d) still shows as chosen.
  if (
    range.kind !== "absolute" &&
    range.token &&
    !options.some((option) => option.value === range.token)
  ) {
    options.push({
      value: range.token,
      label: <>{range.token === "all" ? "All" : range.token}</>,
    });
  }
  const choices = [...options, { value: CUSTOM, label: <>Custom</> }];
  const chosen =
    customOpen || range.kind === "absolute"
      ? CUSTOM
      : (range.token ?? presets[0]?.value ?? CUSTOM);

  function go(next: URLSearchParams) {
    const query = next.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function choose(value: string) {
    setError(null);
    if (value === CUSTOM) {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    go(withRange(searchParams, { range: value }));
  }

  function apply(event: React.FormEvent) {
    event.preventDefault();
    const problem = checkCustomRange(from, to, today);
    setError(problem);
    if (!problem) go(withRange(searchParams, { from, to }));
  }

  const open = customOpen || range.kind === "absolute";

  return (
    <div className={cn("space-y-2", className)}>
      <SegmentedControl
        label="Date range"
        options={choices}
        value={chosen}
        onValueChange={choose}
      />

      {open && (
        <form onSubmit={apply} className="flex flex-wrap items-end gap-x-3 gap-y-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            From
            <Input
              type="date"
              name="from"
              value={from}
              max={today}
              onChange={(event) => setFrom(event.target.value)}
              aria-invalid={error ? true : undefined}
              className="w-40 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            To
            <Input
              type="date"
              name="to"
              value={to}
              max={today}
              onChange={(event) => setTo(event.target.value)}
              aria-invalid={error ? true : undefined}
              className="w-40 text-foreground"
            />
          </label>
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            Apply
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <RangeSummary range={range} detail={detail} pending={pending} />
    </div>
  );
}

/**
 * Chooses the window of days a page shows, by preset or by dates, in the
 * address (`?range=90d`, `?from=…&to=…`), so a view can be shared and a
 * refresh keeps it. The page resolves the address with `resolveDateRange` and
 * passes the result back, so what is shown as chosen is what is in effect.
 */
export function DateRangeSelector(props: DateRangeSelectorProps) {
  const { range, detail } = props;
  return (
    <Suspense fallback={<RangeSummary range={range} detail={detail} />}>
      <Selector
        key={`${range.kind}:${range.start}:${range.end}`}
        {...props}
      />
    </Suspense>
  );
}
