import { db } from "@/lib/db";
import { episodeAssessments } from "@/lib/db/schema";
import type { BipolarType } from "./config";
import { hasCurrentPatternProvenance } from "./provenance";

/**
 * Whether any stored pattern result came from an older algorithm, profile or
 * configuration. Those stay hidden until history is recomputed, so a sync that
 * finds one recomputes it all instead of waiting for someone to ask.
 */
export async function hasOutdatedPatternResults(
  configVersion: number,
  bipolarType: BipolarType
): Promise<boolean> {
  const provenances = await db
    .selectDistinct({
      configVersion: episodeAssessments.configVersion,
      bipolarProfile: episodeAssessments.bipolarProfile,
      algorithmVersion: episodeAssessments.algorithmVersion,
      signalMode: episodeAssessments.signalMode,
    })
    .from(episodeAssessments);
  return provenances.some(
    (provenance) =>
      !hasCurrentPatternProvenance(provenance, configVersion, bipolarType)
  );
}
