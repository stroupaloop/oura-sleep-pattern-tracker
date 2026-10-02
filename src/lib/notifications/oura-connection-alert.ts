import type { OuraConnectionHealth } from "@/lib/oura/connection-health";
import { isProductionDeployment } from "@/lib/visit-alert-policy";
import { escapeHtml, row } from "@/lib/notifications/visit-alert";

export interface OuraConnectionAlert {
  subject: string;
  html: string;
  text: string;
}

/** Production only by default, like the other alerts; the flag forces it either way. */
export function ouraConnectionAlertsEnabled(env: {
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

const DAY_SECONDS = 24 * 60 * 60;

function etDay(seconds: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date(seconds * 1000));
}

/**
 * A rejected connection is reported on its first failure, anything else once
 * it has failed for a day, and both again on the first failure of each later
 * ET day while they last. Judged from attempt times, so it holds however
 * often the sync is scheduled.
 */
export function shouldSendOuraConnectionAlert(
  health: OuraConnectionHealth
): boolean {
  const { lastFailureAt, previousFailureAt, failingSince } = health;
  if (health.state !== "failing" || lastFailureAt == null) return false;

  const firstOfDay =
    previousFailureAt == null || etDay(previousFailureAt) !== etDay(lastFailureAt);
  if (health.needsReconnect) return firstOfDay;

  const since = failingSince ?? lastFailureAt;
  if (lastFailureAt - since < DAY_SECONDS) return false;
  const justReachedADay =
    previousFailureAt != null && previousFailureAt - since < DAY_SECONDS;
  return justReachedADay || firstOfDay;
}

function formatEt(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildOuraConnectionAlert(input: {
  health: OuraConnectionHealth;
  siteUrl?: string | null;
}): OuraConnectionAlert {
  const { health } = input;
  const subject = health.needsReconnect
    ? "Oura stopped syncing: reconnect needed"
    : "Oura sync keeps failing";
  const intro = health.needsReconnect
    ? "Oura rejected the app's connection, so nothing new will arrive until it is reconnected."
    : "The scheduled Oura sync has failed for a day.";
  const consequence =
    "Until then the dashboard shows no new nights and the early-warning checks have nothing new to read.";

  const details: [string, string][] = [
    [
      "Last data stored",
      health.lastSyncedAt != null ? `${formatEt(health.lastSyncedAt)} ET` : "Unknown",
    ],
    [
      "Failed attempts",
      `${health.consecutiveFailures}${
        health.failingSince != null
          ? ` since ${formatEt(health.failingSince)} ET`
          : ""
      }`,
    ],
    ["Error", health.lastError ?? "Unknown"],
  ];

  const settingsUrl = input.siteUrl
    ? `${input.siteUrl.replace(/\/$/, "")}/dashboard/settings`
    : null;
  const action = health.needsReconnect ? "Reconnect Oura" : "Open settings";
  const footer = settingsUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(
        settingsUrl
      )}" style="color:#e0709a">${action}</a></p>`
    : "";

  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5">
<p style="margin:0 0 12px">${escapeHtml(intro)} ${escapeHtml(consequence)}</p>
<table style="border-collapse:collapse">${details
    .map(([label, value]) => row(label, value))
    .join("")}</table>${footer}
</div>`;

  const text = [
    `${intro} ${consequence}`,
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    ...(settingsUrl ? ["", `${action}: ${settingsUrl}`] : []),
  ].join("\n");

  return { subject, html, text };
}
