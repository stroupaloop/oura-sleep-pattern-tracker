import { shiftIsoDay } from "@/lib/date-utils";

/**
 * The window of days a page shows, chosen in the address so a view can be
 * shared and a refresh keeps it: `?range=90d` (the last 90 days, ending
 * today), `?range=all`, or `?from=2026-07-01&to=2026-07-31`. A bare number is
 * days (`?range=30`), `1y` is 365 days, and `start`/`end` are read as
 * `from`/`to`. Days are app-time `YYYY-MM-DD`, both ends inclusive; a night is
 * dated by the morning it ends, as everywhere else.
 */

export interface RangePreset {
  /** The `range` value in the address. */
  value: string;
  /** Days ending today; null for everything on record. */
  days: number | null;
  /** On the control. */
  label: string;
  /** For screen readers, where the label is short. */
  spoken: string;
}

const PRESETS: readonly RangePreset[] = [
  { value: "7d", days: 7, label: "7d", spoken: "7 days" },
  { value: "14d", days: 14, label: "14d", spoken: "14 days" },
  { value: "30d", days: 30, label: "30d", spoken: "30 days" },
  { value: "90d", days: 90, label: "90d", spoken: "90 days" },
  { value: "180d", days: 180, label: "180d", spoken: "180 days" },
  { value: "1y", days: 365, label: "1y", spoken: "1 year" },
  { value: "all", days: null, label: "All", spoken: "All time" },
];

/** The longest window any page will draw, however it was asked for. */
export const MAX_RANGE_DAYS = 3650;

/** Every address key a range can arrive in, so a new choice can clear the old one. */
export const RANGE_PARAM_KEYS = ["range", "from", "to", "start", "end"] as const;

/** The presets a page offers, in the order given. */
export function presetsFor(values: readonly string[]): RangePreset[] {
  return values.flatMap((value) => {
    const preset = PRESETS.find((candidate) => candidate.value === value);
    return preset ? [preset] : [];
  });
}

export type RangeKind = "relative" | "absolute" | "all";

export interface ResolvedRange {
  kind: RangeKind;
  /** `range` value for a relative or all-time range ("90d", "1y", "all"); null for dates. */
  token: string | null;
  /** First day shown; null only for all-time when no earliest day is known. */
  start: string | null;
  /** Last day shown: never after today. */
  end: string;
  /** Days from start to end, inclusive; null when start is null. */
  days: number | null;
}

export type RangeParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A real calendar day written `YYYY-MM-DD`. */
export function isIsoDay(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Days from `start` to `end`, both counted. */
export function daysBetween(start: string, end: string): number {
  const difference =
    Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`);
  return Math.round(difference / 86_400_000) + 1;
}

/** A `range` value as the days it means (null for all-time), or undefined if it is not one. */
function parseRangeToken(
  raw: string | undefined,
  allowAll = true
): { token: string; days: number | null } | undefined {
  if (!raw) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === "all") return allowAll ? { token: "all", days: null } : undefined;
  const match = /^(\d{1,4})(d|y)?$/.exec(value);
  if (!match) return undefined;
  const days = Number(match[1]) * (match[2] === "y" ? 365 : 1);
  if (days < 1 || days > MAX_RANGE_DAYS) return undefined;
  const preset = PRESETS.find((candidate) => candidate.days === days);
  return { token: preset?.value ?? `${days}d`, days };
}

/**
 * What a page should show for its address. Dates win over `range`; anything
 * that is not a real day or a known range is ignored in favor of the page's
 * default; a start after the end swaps them; the end never passes today, and
 * a window longer than `MAX_RANGE_DAYS` keeps its end. `earliest` is the first
 * day on record, which "all" starts from; a page that cannot draw all-time
 * passes `allowAll: false`, and "all" in its address is ignored.
 */
export function resolveDateRange(
  params: RangeParams,
  options: {
    today: string;
    defaultToken: string;
    earliest?: string | null;
    allowAll?: boolean;
  }
): ResolvedRange {
  const { today } = options;
  const fallback = parseRangeToken(options.defaultToken) ?? {
    token: "90d",
    days: 90,
  };
  const earliest = isIsoDay(options.earliest ?? undefined)
    ? (options.earliest as string)
    : null;

  const fromValue = first(params.from) ?? first(params.start);
  const toValue = first(params.to) ?? first(params.end);
  const from = isIsoDay(fromValue) ? fromValue : undefined;
  const to = isIsoDay(toValue) ? toValue : undefined;

  if (from || to) {
    let startRaw = from;
    let endRaw = to;
    if (startRaw && endRaw && startRaw > endRaw) {
      [startRaw, endRaw] = [endRaw, startRaw];
    }
    const end = endRaw && endRaw < today ? endRaw : today;
    let start =
      startRaw ??
      shiftIsoDay(end, -((fallback.days ?? 90) - 1)) ??
      end;
    if (start > end) start = end;
    if (daysBetween(start, end) > MAX_RANGE_DAYS) {
      start = shiftIsoDay(end, -(MAX_RANGE_DAYS - 1)) ?? start;
    }
    return {
      kind: "absolute",
      token: null,
      start,
      end,
      days: daysBetween(start, end),
    };
  }

  const chosen =
    parseRangeToken(first(params.range), options.allowAll ?? true) ?? fallback;
  if (chosen.days === null) {
    const start = earliest && earliest <= today ? earliest : null;
    return {
      kind: "all",
      token: "all",
      start,
      end: today,
      days: start ? daysBetween(start, today) : null,
    };
  }
  const start = shiftIsoDay(today, -(chosen.days - 1)) ?? today;
  return {
    kind: "relative",
    token: chosen.token,
    start,
    end: today,
    days: chosen.days,
  };
}

function formatDay(day: string, withYear: boolean): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(new Date(`${day}T12:00:00Z`));
}

/** "Jul 12 – Oct 9, 2026 · 90 days": the year once, or on both ends when it differs. */
export function describeDateRange(range: ResolvedRange): string {
  const prefix = range.kind === "all" ? "All time" : null;
  if (!range.start) {
    return [prefix ?? "All time", `through ${formatDay(range.end, true)}`].join(" · ");
  }
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  const span =
    range.start === range.end
      ? formatDay(range.end, true)
      : sameYear
        ? `${formatDay(range.start, false)} – ${formatDay(range.end, true)}`
        : `${formatDay(range.start, true)} – ${formatDay(range.end, true)}`;
  const count = range.days ?? daysBetween(range.start, range.end);
  return [
    ...(prefix ? [prefix] : []),
    span,
    `${count} ${count === 1 ? "day" : "days"}`,
  ].join(" · ");
}

/** A new address query with `choice` in place of any range already in it. */
export function withRange(
  current: { toString(): string },
  choice: { range: string } | { from: string; to: string }
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const key of RANGE_PARAM_KEYS) next.delete(key);
  if ("range" in choice) {
    next.set("range", choice.range);
  } else {
    next.set("from", choice.from);
    next.set("to", choice.to);
  }
  return next;
}

/** Why a pair of dates cannot be applied, or null when it can. */
export function checkCustomRange(
  from: string,
  to: string,
  today: string
): string | null {
  if (!isIsoDay(from) || !isIsoDay(to)) return "Choose both a start and an end date.";
  if (from > to) return "The start date must be on or before the end date.";
  if (to > today) return "The end date cannot be in the future.";
  if (daysBetween(from, to) > MAX_RANGE_DAYS) {
    return "That range is longer than ten years.";
  }
  return null;
}

/** Whether a day (or a row dated by one) falls inside the range. */
export function inDateRange(day: string, range: ResolvedRange): boolean {
  return (range.start === null || day >= range.start) && day <= range.end;
}

export function filterToDateRange<T extends { day: string }>(
  rows: readonly T[],
  range: ResolvedRange
): T[] {
  return rows.filter((row) => inDateRange(row.day, range));
}
