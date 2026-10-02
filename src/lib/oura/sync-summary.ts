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

export function formatOuraSyncSummary(
  value: unknown,
  options: SyncSummaryOptions
): string {
  const data = isRecord(value) ? value : {};
  const coreRecords = readCount(data.records);
  const privateRecords = readCount(data.sensitiveRecords);
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
  const notSharedDatasets = labelsFor(true);
  const unavailableDatasets = labelsFor(false);
  const startDate = readString(data.startDate);
  const endDate = readString(data.endDate);
  const range =
    options.includeRange && startDate && endDate
      ? ` (${startDate} to ${endDate})`
      : "";
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
  const recomputedNights = isRecord(data.analysis)
    ? readCount(data.analysis.daysProcessed)
    : null;
  const isPartial =
    data.status === "partial" ||
    unavailableDatasets.length > 0 ||
    notSharedDatasets.length > 0 ||
    failedSteps.length > 0;
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
