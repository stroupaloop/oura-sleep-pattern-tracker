import { and, desc, inArray, ne, notLike } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";
import {
  assessOuraConnection,
  type OuraConnectionHealth,
} from "./connection-health";

/** Core sync attempts only: the heart-rate and private channels fail separately. */
const coreSyncs = and(
  ne(syncLog.syncType, "cron-hr"),
  notLike(syncLog.syncType, "%-sensitive")
);

export async function loadOuraConnectionHealth(): Promise<OuraConnectionHealth> {
  const [recent, lastStored] = await Promise.all([
    db
      .select({
        syncType: syncLog.syncType,
        status: syncLog.status,
        errorMessage: syncLog.errorMessage,
        createdAt: syncLog.createdAt,
      })
      .from(syncLog)
      .where(coreSyncs)
      .orderBy(desc(syncLog.createdAt))
      .limit(40),
    db
      .select({ createdAt: syncLog.createdAt })
      .from(syncLog)
      .where(and(coreSyncs, inArray(syncLog.status, ["success", "partial"])))
      .orderBy(desc(syncLog.createdAt))
      .limit(1),
  ]);
  return assessOuraConnection(recent, lastStored[0]?.createdAt ?? null);
}
