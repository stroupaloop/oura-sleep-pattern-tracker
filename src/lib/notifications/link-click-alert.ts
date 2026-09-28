import {
  describeDevice,
  escapeHtml,
  formatEt,
  ordinal,
  row,
} from "@/lib/notifications/visit-alert";

const NOTE_PREVIEW_LENGTH = 200;

export interface LinkClickAlertInput {
  email: string;
  link: string;
  note: string | null;
  /** When the thought carrying the link was written, unix seconds. */
  writtenAt: number;
  clickedAt: number;
  /** How many times the link has been opened, including this one. */
  clickNumber: number;
  userAgent: string | null;
  siteUrl?: string | null;
}

export interface LinkClickAlert {
  subject: string;
  html: string;
  text: string;
}

export function linkHost(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

function notePreview(note: string | null): string | null {
  const trimmed = note?.trim();
  if (!trimmed) return null;
  return trimmed.length > NOTE_PREVIEW_LENGTH
    ? `${trimmed.slice(0, NOTE_PREVIEW_LENGTH).trimEnd()}…`
    : trimmed;
}

export function buildLinkClickAlert(input: LinkClickAlertInput): LinkClickAlert {
  const host = linkHost(input.link);
  const timesLabel =
    input.clickNumber <= 1 ? "first time" : `${ordinal(input.clickNumber)} time`;
  const subject = `🔗 ${input.email} opened your ${host} link (${timesLabel})`;

  const note = notePreview(input.note);
  const fields: [string, string][] = [
    ["Who", input.email],
    ["Link", input.link],
    ...(note ? ([["Note", note]] as [string, string][]) : []),
    ["Sent", formatEt(input.writtenAt)],
    ["Opened", formatEt(input.clickedAt)],
    ["Times opened", String(input.clickNumber)],
    ["Device", describeDevice(input.userAgent)],
  ];

  const footer = input.siteUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(
        input.siteUrl
      )}" style="color:#e0709a">Open the site</a></p>`
    : "";

  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5">
<p style="margin:0 0 12px">${escapeHtml(`A link you sent was just opened.`)}</p>
<table style="border-collapse:collapse">${fields
    .map(([label, value]) => row(label, value))
    .join("")}</table>${footer}
</div>`;

  const text = [
    "A link you sent was just opened.",
    "",
    ...fields.map(([label, value]) => `${label}: ${value}`),
    ...(input.siteUrl ? ["", input.siteUrl] : []),
  ].join("\n");

  return { subject, html, text };
}
