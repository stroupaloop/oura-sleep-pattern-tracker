import { loadActiveConfig, loadBipolarType } from "@/lib/analysis/config";
import {
  runCyclePredictions,
  type CycleComputationOutcome,
} from "@/lib/analysis/cycle";
import { runHealthSignalDetection } from "@/lib/analysis/health-signals";
import { reprocessAll, type ReprocessResult } from "@/lib/analysis/reprocess";
import { renewOuraTokenIfDue } from "./client";
import type { OuraSyncWarning } from "./contracts";
import { syncDateRange, syncSensitiveDateRange } from "./sync";

export type SyncPipelineStep =
  | "private_sync"
  | "cycle_predictions"
  | "pattern_checks"
  | "health_signals";

export interface SyncPipelineOptions {
  startDate: string;
  endDate: string;
  syncType: "cron" | "manual" | "backfill";
  /** Fetch the private datasets and run the analyses that depend on them. */
  includePrivate: boolean;
  /**
   * Which nights to recompute pattern checks for: the synced window, or every
   * night on record, so history follows the current algorithm.
   */
  recompute: "window" | "history";
}

export interface SyncPipelineResult {
  startDate: string;
  endDate: string;
  status: "success" | "partial";
  records: number;
  sensitiveRecords: number;
  warnings: OuraSyncWarning[];
  /** Steps after the core sync that failed; the ones after them still ran. */
  failedSteps: Array<{ step: SyncPipelineStep; message: string }>;
  cyclesDetected: number;
  analysis: ReprocessResult | null;
  healthSignals: number;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Syncs a day range from Oura, then recomputes what depends on it. A failed
 * core sync throws, since nothing new arrived; any later step that fails is
 * reported and the rest still run, so fresh sleep data always reaches the
 * pattern checks.
 */
export async function runOuraSyncPipeline(
  options: SyncPipelineOptions
): Promise<SyncPipelineResult> {
  const { startDate, endDate, syncType, includePrivate } = options;
  await renewOuraTokenIfDue();
  const core = await syncDateRange(startDate, endDate, syncType);

  const warnings = [...core.warnings];
  const failedSteps: SyncPipelineResult["failedSteps"] = [];
  const attempt = async <T>(
    step: SyncPipelineStep,
    task: () => Promise<T>
  ): Promise<T | null> => {
    try {
      return await task();
    } catch (error) {
      console.error(`Oura sync step ${step} failed:`, error);
      failedSteps.push({ step, message: messageOf(error) });
      return null;
    }
  };

  let sensitiveRecords = 0;
  let cyclesDetected = 0;
  let cycleEvaluation: CycleComputationOutcome | null = null;
  if (includePrivate) {
    const privateResult = await attempt("private_sync", () =>
      syncSensitiveDateRange(startDate, endDate, syncType)
    );
    if (privateResult) {
      sensitiveRecords = privateResult.records;
      warnings.push(...privateResult.warnings);
    }

    const cycles = await attempt("cycle_predictions", () =>
      runCyclePredictions()
    );
    if (cycles) {
      cyclesDetected = cycles.cyclesDetected;
      cycleEvaluation = cycles.evaluation;
    }
  }

  const analysis = await attempt("pattern_checks", async () => {
    const [config, bipolarType] = await Promise.all([
      loadActiveConfig(),
      loadBipolarType(),
    ]);
    return reprocessAll(
      config,
      options.recompute === "history" ? undefined : startDate,
      endDate,
      bipolarType
    );
  });

  let healthSignals = 0;
  if (includePrivate && cycleEvaluation) {
    const evaluation = cycleEvaluation;
    const detection = await attempt("health_signals", () =>
      runHealthSignalDetection(evaluation)
    );
    healthSignals = detection?.signals ?? 0;
  }

  return {
    startDate,
    endDate,
    status: warnings.length > 0 || failedSteps.length > 0 ? "partial" : "success",
    records: core.records,
    sensitiveRecords,
    warnings,
    failedSteps,
    cyclesDetected,
    analysis,
    healthSignals,
  };
}
