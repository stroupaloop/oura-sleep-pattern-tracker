import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { thoughtLinkClicks } from "@/lib/db/schema";
import { getAuthorEmail } from "@/lib/access";
import { decideAlert } from "@/lib/visit-alert-policy";
import { buildLinkClickAlert } from "@/lib/notifications/link-click-alert";
import { sendEmail } from "@/lib/notifications/email";

/** Repeat opens of the same link inside this window share one email. */
const ALERT_WINDOW_MINUTES = 5;

export interface LinkClick {
  thought: {
    id: number;
    link: string;
    note: string | null;
    createdAt: number;
  };
  email: string;
  userAgent: string | null;
  clickedAt: number;
}

/**
 * Stores the click, then emails the author unless this link already sent one
 * in the last few minutes. Callers skip authors and non-production
 * deployments, which share the live database.
 */
export async function recordLinkClick(click: LinkClick): Promise<void> {
  const { thought } = click;
  const [priorClicks, lastAlertedAt] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(thoughtLinkClicks)
      .where(eq(thoughtLinkClicks.thoughtId, thought.id))
      .then((rows) => Number(rows[0]?.count ?? 0)),
    db
      .select({ createdAt: thoughtLinkClicks.createdAt })
      .from(thoughtLinkClicks)
      .where(
        and(
          eq(thoughtLinkClicks.thoughtId, thought.id),
          eq(thoughtLinkClicks.alerted, 1)
        )
      )
      .orderBy(desc(thoughtLinkClicks.createdAt))
      .limit(1)
      .then((rows) => rows[0]?.createdAt ?? null),
  ]);

  const decision = decideAlert({
    enabled: true,
    isAuthor: false,
    userAgent: click.userAgent,
    lastAlertedAt,
    now: click.clickedAt,
    windowMinutes: ALERT_WINDOW_MINUTES,
  });

  await db.insert(thoughtLinkClicks).values({
    thoughtId: thought.id,
    email: click.email,
    userAgent: click.userAgent,
    alerted: decision.alert ? 1 : 0,
    createdAt: click.clickedAt,
  });

  if (!decision.alert) return;
  const recipient = process.env.VISIT_ALERT_TO ?? getAuthorEmail();
  if (!recipient) return;

  const alert = buildLinkClickAlert({
    email: click.email,
    link: thought.link,
    note: thought.note,
    writtenAt: thought.createdAt,
    clickedAt: click.clickedAt,
    clickNumber: priorClicks + 1,
    userAgent: click.userAgent,
    siteUrl: process.env.NEXTAUTH_URL ?? null,
  });
  await sendEmail(recipient, alert.subject, alert.html, { text: alert.text });
}

/**
 * Opens per thought, for the author's timeline. Null when the read fails, so
 * the timeline shows no count rather than a false "not opened".
 */
export async function loadLinkClickCounts(
  thoughtIds: number[]
): Promise<Map<number, number> | null> {
  if (thoughtIds.length === 0) return new Map();
  const rows = await db
    .select({
      thoughtId: thoughtLinkClicks.thoughtId,
      count: sql<number>`count(*)`,
    })
    .from(thoughtLinkClicks)
    .where(inArray(thoughtLinkClicks.thoughtId, thoughtIds))
    .groupBy(thoughtLinkClicks.thoughtId)
    // Counts are a nicety; a failed read must not take the timeline down.
    .catch((error) => {
      console.error("Failed to load link click counts:", error);
      return null;
    });
  if (!rows) return null;
  return new Map(rows.map((row) => [row.thoughtId, Number(row.count)]));
}
