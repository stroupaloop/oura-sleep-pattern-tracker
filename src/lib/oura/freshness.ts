import type { OuraSyncWarningCode } from "./contracts";

export type SyncChannel = "core" | "private" | "heart-rate";
export type SyncAttemptStatus = "success" | "partial" | "error" | "unknown";

export interface SyncAttemptRow {
  syncType: string;
  status: string;
  errorMessage: string | null;
  createdAt: number;
}

export interface SyncAttemptSummary {
  channel: SyncChannel;
  status: SyncAttemptStatus;
  attemptedAt: number;
  unavailableDatasets: string[];
}

export interface DatasetFreshness {
  state: "checked" | "retained" | "unavailable" | "unknown";
  attemptedAt: number | null;
  lastSourceDay: string | null;
}

const WARNING_CODES = new Set<OuraSyncWarningCode>([
  "unauthorized",
  "forbidden",
  "rate_limited",
  "api_error",
  "upstream_error",
  "invalid_response",
  "unexpected_error",
]);

export function getSyncChannel(syncType: string): SyncChannel {
  if (syncType === "cron-hr") return "heart-rate";
  if (syncType.endsWith("-sensitive")) return "private";
  return "core";
}

function normalizeStatus(status: string): SyncAttemptStatus {
  if (status === "success" || status === "partial" || status === "error") {
    return status;
  }
  return "unknown";
}

export function parseUnavailableDatasets(
  errorMessage: string | null
): string[] {
  if (!errorMessage) return [];

  const datasets = new Set<string>();
  for (const entry of errorMessage.split(",")) {
    const separator = entry.lastIndexOf(":");
    if (separator <= 0) continue;
    const dataset = entry.slice(0, separator);
    const code = entry.slice(separator + 1) as OuraSyncWarningCode;
    if (!/^[A-Za-z0-9_]+$/.test(dataset) || !WARNING_CODES.has(code)) {
      continue;
    }
    datasets.add(dataset);
  }
  return [...datasets];
}

export function projectLatestSyncAttempts(
  rows: SyncAttemptRow[]
): Partial<Record<SyncChannel, SyncAttemptSummary>> {
  const channelPriority: Record<SyncChannel, number> = {
    private: 2,
    core: 1,
    "heart-rate": 0,
  };
  const ordered = [...rows].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return right.createdAt - left.createdAt;
    }
    return (
      channelPriority[getSyncChannel(right.syncType)] -
      channelPriority[getSyncChannel(left.syncType)]
    );
  });
  const summaries: Partial<Record<SyncChannel, SyncAttemptSummary>> = {};

  for (const row of ordered) {
    const channel = getSyncChannel(row.syncType);
    if (summaries[channel]) continue;
    summaries[channel] = {
      channel,
      status: normalizeStatus(row.status),
      attemptedAt: row.createdAt,
      unavailableDatasets: parseUnavailableDatasets(row.errorMessage),
    };
  }

  return summaries;
}

export function selectLatestDashboardSyncAttempt(
  rows: SyncAttemptRow[],
  includePrivate: boolean
): SyncAttemptSummary | null {
  const attempts = projectLatestSyncAttempts(rows);
  const candidates = [
    attempts.core,
    includePrivate ? attempts.private : undefined,
  ].filter((attempt): attempt is SyncAttemptSummary => attempt != null);

  return (
    candidates.sort((left, right) => {
      if (left.attemptedAt !== right.attemptedAt) {
        return right.attemptedAt - left.attemptedAt;
      }
      return Number(right.channel === "private") -
        Number(left.channel === "private");
    })[0] ?? null
  );
}

export function resolveDatasetFreshness(
  attempt: SyncAttemptSummary | null | undefined,
  dataset: string,
  lastSourceDay: string | null
): DatasetFreshness {
  if (!attempt || attempt.status === "unknown") {
    return { state: "unknown", attemptedAt: null, lastSourceDay };
  }

  const unavailable =
    attempt.status === "error" ||
    attempt.unavailableDatasets.includes(dataset);
  if (unavailable) {
    return {
      state: lastSourceDay ? "retained" : "unavailable",
      attemptedAt: attempt.attemptedAt,
      lastSourceDay,
    };
  }

  return {
    state: "checked",
    attemptedAt: attempt.attemptedAt,
    lastSourceDay,
  };
}
