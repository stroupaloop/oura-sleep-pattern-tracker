import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";

const KEY = "thoughts_fallback_enabled";

export interface FallbackSetting {
  enabled: boolean;
  /** Unix seconds of the last switch; null while it has never been changed. */
  updatedAt: number | null;
  updatedBy: string | null;
}

/** On until an admin turns it off, so a missing row keeps the old behavior. */
export async function loadFallbackSetting(): Promise<FallbackSetting> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, KEY))
    .limit(1);
  const row = rows[0];
  return {
    enabled: row ? row.value !== "0" : true,
    updatedAt: row?.updatedAt ?? null,
    updatedBy: row?.updatedBy ?? null,
  };
}

export async function saveFallbackSetting(
  enabled: boolean,
  email: string,
  now: number
): Promise<void> {
  const value = enabled ? "1" : "0";
  await db
    .insert(appSettings)
    .values({ key: KEY, value, updatedAt: now, updatedBy: email })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: now, updatedBy: email },
      // Saving the value it already has keeps the original time, which is
      // when the quiet-stretch clock restarted.
      setWhere: sql`${appSettings.value} <> ${value}`,
    });
}
