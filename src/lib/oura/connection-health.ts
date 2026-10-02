import { getSyncChannel, type SyncAttemptRow } from "./freshness";

export interface OuraConnectionHealth {
  /** "failing" once the newest core sync attempt errored. */
  state: "ok" | "failing" | "unknown";
  /** When the newest core sync that stored data ran. */
  lastSyncedAt: number | null;
  /** When the current run of failed core syncs began, as far as the rows reach. */
  failingSince: number | null;
  consecutiveFailures: number;
  /** When the newest failed attempt ran. */
  lastFailureAt: number | null;
  /** When the failed attempt before it ran, if it was part of the same run. */
  previousFailureAt: number | null;
  /** Oura rejected the connection itself, which only a reconnect fixes. */
  needsReconnect: boolean;
  /** The error the newest failed attempt recorded. */
  lastError: string | null;
}

// Refresh tokens are single-use: once one is rejected, every later sync fails
// the same way until someone reconnects.
const RECONNECT_ERROR = /token_refresh|token_exchange|HTTP 401|daily scope/;

/**
 * Judges the Oura connection from core sync attempts, newest first or not.
 * `lastSyncedAt` falls back to `lastSuccessAt` when every row in the window
 * failed, so a long outage still reports when data last arrived.
 */
export function assessOuraConnection(
  rows: SyncAttemptRow[],
  lastSuccessAt: number | null = null
): OuraConnectionHealth {
  const core = rows
    .filter((row) => getSyncChannel(row.syncType) === "core")
    .sort((left, right) => right.createdAt - left.createdAt);
  if (core.length === 0) {
    return {
      state: lastSuccessAt == null ? "unknown" : "ok",
      lastSyncedAt: lastSuccessAt,
      failingSince: null,
      consecutiveFailures: 0,
      lastFailureAt: null,
      previousFailureAt: null,
      needsReconnect: false,
      lastError: null,
    };
  }

  let consecutiveFailures = 0;
  while (
    consecutiveFailures < core.length &&
    core[consecutiveFailures].status === "error"
  ) {
    consecutiveFailures++;
  }
  const newestStored = core.find(
    (row) => row.status === "success" || row.status === "partial"
  );
  const lastError =
    consecutiveFailures > 0 ? core[0].errorMessage ?? null : null;

  return {
    state: consecutiveFailures > 0 ? "failing" : "ok",
    lastSyncedAt: newestStored?.createdAt ?? lastSuccessAt,
    failingSince:
      consecutiveFailures > 0 ? core[consecutiveFailures - 1].createdAt : null,
    consecutiveFailures,
    lastFailureAt: consecutiveFailures > 0 ? core[0].createdAt : null,
    previousFailureAt: consecutiveFailures > 1 ? core[1].createdAt : null,
    needsReconnect: lastError != null && RECONNECT_ERROR.test(lastError),
    lastError,
  };
}

/**
 * Whether the dashboard should interrupt with the failure. One failed attempt
 * that a reconnect would not fix is usually Oura having a bad hour.
 */
export function shouldShowOuraConnectionProblem(
  health: OuraConnectionHealth
): boolean {
  return (
    health.state === "failing" &&
    (health.needsReconnect || health.consecutiveFailures >= 2)
  );
}
