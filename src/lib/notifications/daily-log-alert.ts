import { isProductionDeployment } from "@/lib/visit-alert-policy";
import { EPISODE_STATES } from "@/lib/episode-states";
import type { DoseSummary } from "@/lib/dose-summary";
import {
  formatMoodScore,
  formatMoodTags,
  formatOptionalScores,
} from "@/lib/daily-log-format";
import { escapeHtml, row } from "@/lib/notifications/visit-alert";

/** How long the log must sit untouched before the alert goes out. */
export const DAILY_LOG_QUIET_SECONDS = 120;

export interface DailyLogAlertInput {
  email: string;
  day: string;
  today: string;
  moodScore: number;
  episodeState: string | null;
  energyScore: number | null;
  irritabilityScore: number | null;
  anxietyScore: number | null;
  sleepSubjective: number | null;
  tags: string[];
  /** Whether a note exists. The note itself is never put in an email. */
  hasNote: boolean;
  doses: DoseSummary;
  siteUrl?: string | null;
}

export interface DailyLogAlert {
  subject: string;
  html: string;
  text: string;
}

/** Production only by default, like the other alerts; the flag forces it either way. */
export function dailyLogAlertsEnabled(env: {
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

/**
 * True while the save that queued the alert is still the newest, so a burst of
 * edits sends one email with the final state instead of one per tap.
 */
export function isLatestLogSave(
  savedAt: number,
  current: { updatedAt: number | null } | null
): boolean {
  return current?.updatedAt === savedAt;
}

function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${day}T12:00:00Z`));
}

export function buildDailyLogAlert(input: DailyLogAlertInput): DailyLogAlert {
  const isToday = input.day === input.today;
  const dayLabel = formatDay(input.day);

  // Kept free of health details: subjects show up in inbox lists and on lock
  // screens.
  const subject = isToday
    ? `📝 ${input.email} saved today's daily log`
    : `📝 ${input.email} saved the daily log for ${dayLabel}`;
  const intro = isToday
    ? `Today's daily log (${dayLabel}) was saved.`
    : `The daily log for ${dayLabel} was saved.`;

  const episode =
    EPISODE_STATES.find((state) => state.value === input.episodeState)
      ?.label ?? "Not set";
  const scores = formatOptionalScores(input);

  const details: [string, string][] = [
    ["Who", input.email],
    ["Mood", `${formatMoodScore(input.moodScore)} (scale -3 to +3)`],
    ["Episode state", episode],
    ...(scores.length > 0
      ? [["Also", scores.join(" · ")] as [string, string]]
      : []),
    ["Tags", formatMoodTags(input.tags) || "None"],
    ["Medications taken", input.doses.taken.join(", ") || "None marked"],
    ...(input.doses.notTaken.length > 0
      ? [["Not marked taken", input.doses.notTaken.join(", ")] as [string, string]]
      : []),
    ["Note", input.hasNote ? "Added (open the site to read it)" : "None"],
  ];

  const footer = input.siteUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(
        input.siteUrl
      )}" style="color:#e0709a">Open the site</a></p>`
    : "";

  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5">
<p style="margin:0 0 12px">${escapeHtml(intro)}</p>
<table style="border-collapse:collapse">${details
    .map(([label, value]) => row(label, value))
    .join("")}</table>${footer}
</div>`;

  const text = [
    intro,
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    ...(input.siteUrl ? ["", `Open the site: ${input.siteUrl}`] : []),
  ].join("\n");

  return { subject, html, text };
}
