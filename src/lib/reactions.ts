import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { thoughtReactions } from "@/lib/db/schema";
import {
  rankRecentReactions,
  type ThoughtReaction,
} from "@/lib/reaction-emojis";

export async function loadRecentReactions(email: string): Promise<string[]> {
  const usage = await db
    .select({
      emoji: thoughtReactions.emoji,
      uses: sql<number>`count(*)`,
      lastUsedAt: sql<number>`max(${thoughtReactions.updatedAt})`,
    })
    .from(thoughtReactions)
    .where(eq(thoughtReactions.email, email.toLowerCase()))
    .groupBy(thoughtReactions.emoji)
    .orderBy(desc(sql`count(*)`))
    .catch((error) => {
      console.error("Failed to load recent reactions:", error);
      return [];
    });
  return rankRecentReactions(
    usage.map((row) => ({
      emoji: row.emoji,
      uses: Number(row.uses),
      lastUsedAt: Number(row.lastUsedAt),
    }))
  );
}

/**
 * Reactions per thought. Null when the read fails, so the timeline hides
 * reactions rather than showing an entry as having none.
 */
export async function loadReactionsFor(
  thoughtIds: number[]
): Promise<Map<number, ThoughtReaction[]> | null> {
  if (thoughtIds.length === 0) return new Map();
  const rows = await db
    .select({
      thoughtId: thoughtReactions.thoughtId,
      email: thoughtReactions.email,
      emoji: thoughtReactions.emoji,
    })
    .from(thoughtReactions)
    .where(inArray(thoughtReactions.thoughtId, thoughtIds))
    .orderBy(thoughtReactions.createdAt)
    .catch((error) => {
      console.error("Failed to load reactions:", error);
      return null;
    });
  if (!rows) return null;
  const byThought = new Map<number, ThoughtReaction[]>();
  for (const row of rows) {
    const list = byThought.get(row.thoughtId) ?? [];
    list.push({ email: row.email, emoji: row.emoji });
    byThought.set(row.thoughtId, list);
  }
  return byThought;
}
