import { isProductionDeployment } from "@/lib/visit-alert-policy";
import {
  AS_NEEDED_KEY,
  doseSlotLabel,
  slotsForMedication,
} from "@/lib/medication-schedule";
import { EPISODE_STATES } from "@/lib/episode-states";
import { escapeHtml, row } from "@/lib/notifications/visit-alert";

/** How long the log must sit untouched before the alert goes out. */
export const DAILY_LOG_QUIET_SECONDS = 120;

export interface DoseMedication {
  id: number;
  name: string;
  frequency: string | null;
  doseSchedule: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface DoseLog {
  medicationId: number;
  slot: string | null;
  taken: number;
}

export interface DoseSummary {
  taken: string[];
  notTaken: string[];
}

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

/**
 * The day's scheduled doses, split by whether they were marked taken. An
 * as-needed dose is listed only once taken; weekly and inactive medications
 * are left out, as they are on the check-in.
 */
export function summarizeDoses(
  medications: readonly DoseMedication[],
  logs: readonly DoseLog[],
  day: string
): DoseSummary {
  const takenKeys = new Set(
    logs
      .filter((log) => log.taken === 1)
      .map((log) => `${log.medicationId}:${log.slot ?? AS_NEEDED_KEY}`)
  );
  const summary: DoseSummary = { taken: [], notTaken: [] };

  for (const med of medications) {
    if (med.startDate && med.startDate > day) continue;
    if (med.endDate && med.endDate < day) continue;
    if (med.frequency === "weekly") continue;

    const slots = slotsForMedication(med);
    if (slots.length === 0) {
      if (takenKeys.has(`${med.id}:${AS_NEEDED_KEY}`)) {
        summary.taken.push(med.name);
      }
      continue;
    }
    for (const slot of slots) {
      const label = `${med.name} (${doseSlotLabel(slot)})`;
      if (takenKeys.has(`${med.id}:${slot}`)) summary.taken.push(label);
      else summary.notTaken.push(label);
    }
  }
  return summary;
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
  const scoreEntries: [string, number | null][] = [
    ["Energy", input.energyScore],
    ["Irritability", input.irritabilityScore],
    ["Anxiety", input.anxietyScore],
    ["Sleep quality", input.sleepSubjective],
  ];
  const scores = scoreEntries
    .filter((entry): entry is [string, number] => entry[1] !== null)
    .map(([label, value]) => `${label} ${value}/5`);
  const mood = input.moodScore > 0 ? `+${input.moodScore}` : `${input.moodScore}`;

  const details: [string, string][] = [
    ["Who", input.email],
    ["Mood", `${mood} (scale -3 to +3)`],
    ["Episode state", episode],
    ...(scores.length > 0
      ? [["Also", scores.join(" · ")] as [string, string]]
      : []),
    [
      "Tags",
      input.tags.length > 0
        ? input.tags.map((tag) => tag.replace(/_/g, " ")).join(", ")
        : "None",
    ],
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
