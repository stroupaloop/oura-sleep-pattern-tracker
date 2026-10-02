import { getAuthorEmail } from "@/lib/access";
import { sendEmail } from "@/lib/notifications/email";
import { loadOuraConnectionHealth } from "@/lib/oura/connection-health-data";
import {
  buildOuraConnectionAlert,
  ouraConnectionAlertsEnabled,
  shouldSendOuraConnectionAlert,
} from "@/lib/notifications/oura-connection-alert";

/**
 * Emails the alert recipient after a failed scheduled sync when the run of
 * failures calls for it. A failed alert must not change the cron's outcome.
 */
export async function notifyOuraConnectionFailure(): Promise<void> {
  try {
    const enabled = ouraConnectionAlertsEnabled({
      flag: process.env.OURA_ALERTS_ENABLED,
      vercelEnv: process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV,
    });
    const recipient = process.env.VISIT_ALERT_TO ?? getAuthorEmail();
    if (!enabled || !recipient) return;

    const health = await loadOuraConnectionHealth();
    if (!shouldSendOuraConnectionAlert(health)) return;

    const alert = buildOuraConnectionAlert({
      health,
      siteUrl: process.env.NEXTAUTH_URL ?? null,
    });
    await sendEmail(recipient, alert.subject, alert.html, { text: alert.text });
  } catch (error) {
    console.error("Failed to send Oura connection alert:", error);
  }
}
