import { after } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { thoughtReactions, thoughts } from "@/lib/db/schema";
import { getAuthorEmail, isAuthorEmail } from "@/lib/access";
import { isProductionDeployment } from "@/lib/visit-alert-policy";
import { sendEmail } from "@/lib/notifications/email";
import { buildReactionAlert } from "@/lib/notifications/reaction-alert";

/** A burst of reactions inside this window goes out as one email. */
export const REACTION_QUIET_SECONDS = 120;

/** Production only by default, like the other alerts; the flag forces it either way. */
export function reactionAlertsEnabled(env: {
  flag?: string;
  vercelEnv?: string;
  nodeEnv?: string;
}): boolean {
  if (env.flag === "0") return false;
  if (env.flag === "1") return true;
  return isProductionDeployment({
    vercelEnv: env.vercelEnv,
    nodeEnv: env.nodeEnv,
  });
}

async function sendIfStillLatest(
  email: string,
  savedAt: number,
  recipient: string
) {
  await new Promise((resolve) =>
    setTimeout(resolve, REACTION_QUIET_SECONDS * 1000)
  );

  // A newer reaction queues its own send, which will carry this one too. A
  // removal leaves nothing newer, so an earlier pending reaction still goes.
  const latest = await db
    .select({ at: sql<number | null>`max(${thoughtReactions.updatedAt})` })
    .from(thoughtReactions)
    .where(eq(thoughtReactions.email, email))
    .then((rows) => (rows[0]?.at == null ? null : Number(rows[0].at)));
  if (latest !== savedAt) return;

  const pending = await db
    .select({
      id: thoughtReactions.id,
      emoji: thoughtReactions.emoji,
      note: thoughts.note,
      link: thoughts.link,
      createdAt: thoughts.createdAt,
    })
    .from(thoughtReactions)
    .innerJoin(thoughts, eq(thoughts.id, thoughtReactions.thoughtId))
    .where(
      and(eq(thoughtReactions.email, email), eq(thoughtReactions.notified, 0))
    )
    .orderBy(thoughtReactions.updatedAt);
  if (pending.length === 0) return;

  const alert = buildReactionAlert({
    email,
    reactions: pending,
    siteUrl: process.env.NEXTAUTH_URL ?? null,
  });
  await sendEmail(recipient, alert.subject, alert.html, { text: alert.text });
  await db
    .update(thoughtReactions)
    .set({ notified: 1 })
    .where(
      inArray(
        thoughtReactions.id,
        pending.map((row) => row.id)
      )
    );
}

/**
 * Emails the author about a reader's reactions once they have gone quiet for
 * a couple of minutes. Runs after the response, so reacting never waits on it.
 */
export function queueReactionAlert(input: { email: string; savedAt: number }) {
  const enabled = reactionAlertsEnabled({
    flag: process.env.REACTION_ALERTS_ENABLED,
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  });
  if (!enabled || isAuthorEmail(input.email)) return;
  const recipient = process.env.VISIT_ALERT_TO ?? getAuthorEmail();
  if (!recipient) return;

  after(() =>
    sendIfStillLatest(input.email, input.savedAt, recipient).catch((error) => {
      console.error("Failed to send reaction alert:", error);
    })
  );
}
