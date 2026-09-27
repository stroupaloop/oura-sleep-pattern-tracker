import { APP_TIME_ZONE } from "@/lib/date-utils";

export interface VisitAlertInput {
  email: string | null;
  isAuthed: boolean;
  visitorId: string;
  /** How many visits this visitor has made, including this one. */
  visitNumber: number;
  path: string;
  city: string | null;
  region: string | null;
  country: string | null;
  referrer: string | null;
  userAgent: string | null;
  createdAt: number;
  siteUrl?: string | null;
}

export interface VisitAlert {
  subject: string;
  html: string;
}

export function shortVisitorId(visitorId: string): string {
  return visitorId.replace(/-/g, "").slice(0, 4) || "????";
}

export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("android")) return "Android";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "Mac";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("linux")) return "Linux";
  return "Unknown device";
}

/** Vercel percent-encodes geo headers, so "New York City" arrives as "New%20York%20City". */
function decodeGeo(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function describeLocation(input: {
  city: string | null;
  region: string | null;
  country: string | null;
}): string {
  const parts = [input.city, input.region, input.country]
    .map((part) => (part ? decodeGeo(part).trim() : ""))
    .filter(Boolean);
  if (parts.length === 0) return "Unknown location";
  return parts.join(", ");
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function describeVisitor(input: {
  email: string | null;
  isAuthed: boolean;
  visitorId: string;
}): string {
  if (input.isAuthed && input.email) return input.email;
  return `Anonymous #${shortVisitorId(input.visitorId)}`;
}

export function formatEt(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(unixSeconds * 1000));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function row(label: string, value: string): string {
  return `<tr><td style="padding:4px 12px 4px 0;color:#888;white-space:nowrap">${escapeHtml(
    label
  )}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`;
}

export function buildVisitAlert(input: VisitAlertInput): VisitAlert {
  const who = describeVisitor(input);
  const visitLabel =
    input.visitNumber <= 1 ? "first visit" : `${ordinal(input.visitNumber)} visit`;

  const subject = input.isAuthed
    ? `🦥 ${who} is on the site (${visitLabel})`
    : `🦥 Someone's on the site — ${who} (${visitLabel})`;

  const rows = [
    row("Who", who),
    row("Visit", visitLabel),
    row("When", formatEt(input.createdAt)),
    row("Where", `${describeLocation(input)} (approx, from IP)`),
    row("Device", describeDevice(input.userAgent)),
    row("Page", input.path),
    row("Referrer", input.referrer || "direct"),
  ].join("");

  const footer = input.siteUrl
    ? `<p style="margin:16px 0 0"><a href="${escapeHtml(
        input.siteUrl
      )}" style="color:#e0709a">Open the site</a></p>`
    : "";

  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.5">
<p style="margin:0 0 12px">${escapeHtml(
    input.isAuthed ? "A signed-in visit just happened." : "An anonymous visit just happened."
  )}</p>
<table style="border-collapse:collapse">${rows}</table>${footer}
</div>`;

  return { subject, html };
}
