import { shiftIsoDay } from "./date-utils";

export function averagePresent(values: Array<number | null>): number | null {
  const present = values.filter(
    (value): value is number => value != null && Number.isFinite(value) && value > 0
  );
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

export function computeCalendarRollingAverage(
  points: Array<{ day: string; value: number | null }>,
  windowDays: number
): Array<number | null> {
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    return points.map(() => null);
  }

  return points.map((point) => {
    const startDay = shiftIsoDay(point.day, -(windowDays - 1));
    if (!startDay) return null;

    const values = points
      .filter(
        (candidate) =>
          candidate.day >= startDay && candidate.day <= point.day
      )
      .map((candidate) => candidate.value)
      .filter(
        (value): value is number =>
          value != null && Number.isFinite(value)
      );

    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "--";
  const roundedMinutes = Math.round(seconds / 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function formatDurationDelta(seconds: number): string {
  if (!Number.isFinite(seconds)) return "--";
  if (seconds === 0) return "0m";

  const sign = seconds > 0 ? "+" : "-";
  const roundedMinutes = Math.round(Math.abs(seconds) / 60);
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return `${sign}${duration}`;
}

export function summarizeStoredSamples(serialized: string | null): {
  average: number | null;
  minimum: number | null;
} {
  if (!serialized) return { average: null, minimum: null };

  try {
    const parsed: unknown = JSON.parse(serialized);
    const items = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" &&
          parsed !== null &&
          Array.isArray((parsed as { items?: unknown }).items)
        ? (parsed as { items: unknown[] }).items
        : [];
    const values = items.filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    );
    if (values.length === 0) return { average: null, minimum: null };
    return {
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      minimum: Math.min(...values),
    };
  } catch {
    return { average: null, minimum: null };
  }
}
