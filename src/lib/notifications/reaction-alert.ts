import { APP_TIME_ZONE } from "@/lib/date-utils";
import { escapeHtml } from "@/lib/notifications/visit-alert";
import { linkHost } from "@/lib/notifications/link-click-alert";

const NOTE_EXCERPT_LENGTH = 80;

export interface ReactedThought {
  emoji: string;
  note: string | null;
  link: string | null;
  /** When the thought was logged, unix seconds. */
  createdAt: number;
}

export interface ReactionAlertInput {
  email: string;
  reactions: ReactedThought[];
  siteUrl?: string | null;
}

export interface ReactionAlert {
  subject: string;
  html: string;
  text: string;
}

function formatWhen(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

/** What the reaction was to, in the words the feed would use. */
export function describeReactedThought(thought: ReactedThought): string {
  const note = thought.note?.trim();
  let what: string;
  if (note) {
    const excerpt =
      note.length > NOTE_EXCERPT_LENGTH
        ? `${note.slice(0, NOTE_EXCERPT_LENGTH).trimEnd()}…`
        : note;
    what = `your note "${excerpt}"`;
  } else if (thought.link) {
    what = `your ${linkHost(thought.link)} link`;
  } else {
    what = `"Thought of you"`;
  }
  return `${what} (${formatWhen(thought.createdAt)})`;
}

export function buildReactionAlert(input: ReactionAlertInput): ReactionAlert {
  const count = input.reactions.length;
  const emojis = input.reactions.map((r) => r.emoji).join("");
  const target = count === 1 ? "your thought" : `${count} of your thoughts`;
  const subject = `${emojis} ${input.email} reacted to ${target}`;

  const lines = input.reactions.map(
    (r) => `${r.emoji}  ${describeReactedThought(r)}`
  );

  const footer = input.siteUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(
        input.siteUrl
      )}" style="color:#e0709a">Open the site</a></p>`
    : "";

  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5">
<p style="margin:0 0 12px">${escapeHtml(`${input.email} reacted:`)}</p>
<table style="border-collapse:collapse">${input.reactions
    .map(
      (r) =>
        `<tr><td style="padding:4px 12px 4px 0;font-size:20px;vertical-align:top">${escapeHtml(
          r.emoji
        )}</td><td style="padding:4px 0">${escapeHtml(
          describeReactedThought(r)
        )}</td></tr>`
    )
    .join("")}</table>${footer}
</div>`;

  const text = [
    `${input.email} reacted:`,
    "",
    ...lines,
    ...(input.siteUrl ? ["", input.siteUrl] : []),
  ].join("\n");

  return { subject, html, text };
}
