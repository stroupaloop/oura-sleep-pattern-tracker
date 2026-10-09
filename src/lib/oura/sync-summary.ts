import { formatNightLabel, formatSyncedAt } from "@/lib/health/format";

const DATASET_LABELS: Record<string, string> = {
  daily_resilience: "Resilience",
  daily_spo2: "Blood Oxygen",
  workout: "Workouts",
  session: "Sessions",
  heartrate: "Heart Rate",
  enhanced_tag: "Tags",
  daily_cardiovascular_age: "Cardiovascular Age",
  vO2_max: "VO₂ max",
  sleep_time: "Bedtime Guidance",
  personal_info: "Profile",
};

const STEP_LABELS: Record<string, string> = {
  private_sync: "private data",
  cycle_predictions: "cycle context",
  pattern_checks: "pattern checks",
  health_signals: "health signals",
};

interface SyncSummaryOptions {
  operation: "Sync" | "Backfill";
  includeRange?: boolean;
}

function formatRecordCount(count: number | null, category: string): string {
  if (count === null) return `${category} record count unavailable`;
  return `${count} ${category} record${count === 1 ? "" : "s"}`;
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function formatDatasetLabel(dataset: string): string {
  return (
    DATASET_LABELS[dataset] ??
    dataset
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCount(value: unknown): number | null {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
    ? value
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

interface SyncGaps {
  /** Datasets Oura withheld because the app was not granted them. */
  notShared: string[];
  /** Granted datasets that did not fully update. */
  unavailable: string[];
  /** Steps after the core sync that did not finish. */
  failedSteps: string[];
  partial: boolean;
}

function readSyncGaps(data: Record<string, unknown>): SyncGaps {
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  const labelsFor = (notGranted: boolean) => [
    ...new Set(
      warnings.flatMap((warning) => {
        if (!isRecord(warning)) return [];
        if ((warning.code === "not_granted") !== notGranted) return [];
        const dataset = readString(warning.dataset);
        return dataset ? [formatDatasetLabel(dataset)] : [];
      })
    ),
  ];
  const notShared = labelsFor(true);
  const unavailable = labelsFor(false);
  const failedSteps = [
    ...new Set(
      (Array.isArray(data.failedSteps) ? data.failedSteps : []).flatMap(
        (failure) => {
          const step = isRecord(failure) ? readString(failure.step) : null;
          return step && STEP_LABELS[step] ? [STEP_LABELS[step]] : [];
        }
      )
    ),
  ];
  return {
    notShared,
    unavailable,
    failedSteps,
    partial:
      data.status === "partial" ||
      unavailable.length > 0 ||
      notShared.length > 0 ||
      failedSteps.length > 0,
  };
}

export function formatOuraSyncSummary(
  value: unknown,
  options: SyncSummaryOptions
): string {
  const data = isRecord(value) ? value : {};
  const coreRecords = readCount(data.records);
  const privateRecords = readCount(data.sensitiveRecords);
  const {
    notShared: notSharedDatasets,
    unavailable: unavailableDatasets,
    failedSteps,
    partial: isPartial,
  } = readSyncGaps(data);
  const startDate = readString(data.startDate);
  const endDate = readString(data.endDate);
  const range =
    options.includeRange && startDate && endDate
      ? ` (${startDate} to ${endDate})`
      : "";
  const recomputedNights = isRecord(data.analysis)
    ? readCount(data.analysis.daysProcessed)
    : null;
  const coverage = isPartial ? " with partial coverage" : "";
  const records = `${formatRecordCount(
    coreRecords,
    "core"
  )} and ${formatRecordCount(privateRecords, "private")}`;

  const sentences = [
    `${options.operation} complete${coverage}${range}: processed ${records}.`,
  ];
  if (options.operation === "Backfill" && recomputedNights != null) {
    sentences.push(
      `Pattern checks recomputed for ${recomputedNights} ${
        recomputedNights === 1 ? "night" : "nights"
      }.`
    );
  }
  if (!isPartial) return sentences.join(" ");

  const keptRows =
    "The sync did not delete previously stored source rows for those datasets.";
  if (unavailableDatasets.length > 0) {
    sentences.push(
      `Optional datasets not fully updated: ${formatList(unavailableDatasets)}. ${keptRows}`
    );
  } else if (notSharedDatasets.length === 0 && failedSteps.length === 0) {
    sentences.push(`Some optional datasets were not fully updated. ${keptRows}`);
  }
  if (notSharedDatasets.length > 0) {
    sentences.push(
      `Not shared by Oura: ${formatList(notSharedDatasets)}. Enable ${
        notSharedDatasets.length === 1 ? "it" : "them"
      } for this app in Oura, then reconnect.`
    );
  }
  if (failedSteps.length > 0) {
    sentences.push(
      `Didn't finish: ${formatList(failedSteps)}. Running it again usually completes ${
        failedSteps.length === 1 ? "it" : "them"
      }.`
    );
  }
  return sentences.join(" ");
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeSyncProblems(gaps: SyncGaps): string {
  const problems: string[] = [];
  if (gaps.notShared.length > 0) {
    problems.push(`Oura didn't share ${formatList(gaps.notShared)}`);
  }
  if (gaps.unavailable.length > 0) {
    problems.push(`${formatList(gaps.unavailable)} didn't fully update`);
  }
  if (gaps.failedSteps.length > 0) {
    problems.push(`${formatList(gaps.failedSteps)} didn't finish`);
  }
  return problems.length > 0
    ? formatList(problems)
    : "some optional data didn't fully update";
}

/**
 * What the Sync now button says once a sync has finished and the page has
 * refreshed, from what the sync did rather than from the HTTP status alone:
 * a sync that brought nothing newer, or left datasets or steps undone, is not
 * "up to date".
 */
export function formatSyncNowResult(
  result: unknown,
  {
    latestBefore,
    latestAfter,
    syncedAt,
    today,
  }: {
    /** The newest night on record when the button was tapped. */
    latestBefore: string | null;
    /** The newest night on record now that the page has refreshed. */
    latestAfter: string | null;
    /** When the sync finished, in Unix seconds. */
    syncedAt: number;
    today: string;
  }
): string {
  const gaps = readSyncGaps(isRecord(result) ? result : {});

  if (latestAfter != null && latestAfter === latestBefore && latestAfter < today) {
    const opening = `Synced. Oura had nothing newer than ${formatNightLabel(
      latestAfter,
      { weekday: false }
    )}.`;
    return gaps.partial
      ? `${opening} ${upperFirst(describeSyncProblems(gaps))}. See Settings.`
      : opening;
  }

  const opening = `Synced ${formatSyncedAt(syncedAt, today)}`;
  return gaps.partial
    ? `${opening}, but ${describeSyncProblems(gaps)}. See Settings.`
    : `${opening}.`;
}

/** What the Sync now button says when the route answered with an error. */
export function formatSyncNowFailure(error: unknown): string {
  return typeof error === "string" &&
    /token_refresh|HTTP 401|daily scope/.test(error)
    ? "Oura rejected the connection. Reconnect it in Settings."
    : "Sync didn't finish. Try again in a minute.";
}
