/**
 * The reaction vocabulary, safe to import from client components (no
 * database access here; see reactions.ts for the loaders).
 */

/** Offered before a reader has any history, and used to fill the row after. */
export const DEFAULT_RECENT_REACTIONS = ["❤️", "🥰", "😂", "🥺", "🙏"];

/** Everything the picker offers. The server accepts nothing else. */
export const REACTION_EMOJIS = [
  ...DEFAULT_RECENT_REACTIONS,
  "😍", "😘", "🤗", "😊", "🥹",
  "😭", "😢", "😮", "🤣", "😌",
  "💕", "💖", "🤍", "🫶", "✨",
  "🔥", "💯", "👏", "🙌", "👍",
  "😴", "🌸", "☀️", "🌙", "🎉",
];

export const RECENT_REACTION_COUNT = 5;

const ALLOWED = new Set(REACTION_EMOJIS);

export function isAllowedReaction(value: unknown): value is string {
  return typeof value === "string" && ALLOWED.has(value);
}

export interface ReactionUsage {
  emoji: string;
  uses: number;
  lastUsedAt: number;
}

/**
 * Most-used first, most recent breaking ties, topped up from the defaults so
 * the row is always full.
 */
export function rankRecentReactions(
  usage: ReactionUsage[],
  limit = RECENT_REACTION_COUNT
): string[] {
  const ranked = usage
    .filter((row) => ALLOWED.has(row.emoji))
    .sort((a, b) => b.uses - a.uses || b.lastUsedAt - a.lastUsedAt)
    .map((row) => row.emoji);
  const recents: string[] = [];
  for (const emoji of [...ranked, ...DEFAULT_RECENT_REACTIONS]) {
    if (recents.length >= limit) break;
    if (!recents.includes(emoji)) recents.push(emoji);
  }
  return recents;
}

export interface ThoughtReaction {
  email: string;
  emoji: string;
}
