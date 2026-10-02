import { ouraFetch } from "./client";
import {
  OuraContractError,
  OuraRequestError,
  describeOuraError,
  toOuraSyncWarning,
  type OuraSyncWarning,
} from "./contracts";
import {
  aggregateHeartRateSamples,
  getHeartRateQueryRange,
  splitHeartRateDays,
} from "./heartrate";
import { upsertHeartRateBuckets } from "./heartrate-store";
import type { OuraHeartrateSample } from "./types";

/** Pauses before the second and third attempt at a window. */
export const HEART_RATE_RETRY_DELAYS_MS = [1_000, 3_000];

export interface HeartRateSyncResult {
  /** Days that now have a daily heart-rate bucket from this sync. */
  days: number;
  samples: number;
  skippedSamples: number;
  failedWindows: Array<{ startDay: string; endDay: string }>;
  warning: OuraSyncWarning | null;
}

/** Rate limits, Oura outages, and network or database hiccups pass on retry. */
export function isRetryableHeartRateError(error: unknown): boolean {
  if (error instanceof OuraContractError) return false;
  if (error instanceof OuraRequestError) {
    return error.status === 429 || error.status >= 500;
  }
  return true;
}

/**
 * Fetches, buckets and stores heart rate one window at a time, so a failure
 * costs only its own window instead of the whole range, and a passing hiccup
 * is retried before it costs anything.
 */
export async function syncHeartRateWindows(
  startDate: string,
  endDate: string,
  now: number,
  pause: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))
): Promise<HeartRateSyncResult> {
  const result: HeartRateSyncResult = {
    days: 0,
    samples: 0,
    skippedSamples: 0,
    failedWindows: [],
    warning: null,
  };
  let lastError: unknown = null;

  for (const window of splitHeartRateDays(startDate, endDate)) {
    for (let attempt = 0; ; attempt++) {
      try {
        const range = getHeartRateQueryRange(window.startDay, window.endDay);
        const samples = await ouraFetch<OuraHeartrateSample>(
          "v2/usercollection/heartrate",
          {
            start_datetime: range.startDatetime,
            end_datetime: range.endDatetime,
          },
          // An expired token is refreshed before the request; a 401 after
          // that is a grant problem a refresh cannot fix.
          { refreshUnauthorized: false }
        );
        const buckets = aggregateHeartRateSamples(samples);
        await upsertHeartRateBuckets(buckets, now);
        result.days += buckets.daily.length;
        result.samples += samples.length;
        result.skippedSamples += buckets.skipped;
        break;
      } catch (error) {
        const retry =
          attempt < HEART_RATE_RETRY_DELAYS_MS.length &&
          isRetryableHeartRateError(error);
        console.error(
          `Oura heart rate ${window.startDay}..${window.endDay} attempt ${attempt + 1} failed${
            retry ? ", retrying" : ""
          }: ${describeOuraError(error)}`
        );
        if (!retry) {
          lastError = error;
          result.failedWindows.push(window);
          break;
        }
        await pause(HEART_RATE_RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  if (result.skippedSamples > 0) {
    console.warn(
      `Oura heart rate: left out ${result.skippedSamples} malformed samples`
    );
  }
  if (result.failedWindows.length > 0) {
    result.warning = toOuraSyncWarning("heartrate", lastError);
  }
  return result;
}
