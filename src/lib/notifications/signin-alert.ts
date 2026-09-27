import { isProductionDeployment } from "@/lib/visit-alert-policy";
import {
  describeDevice,
  describeLocation,
  escapeHtml,
  formatEt,
  row,
} from "@/lib/notifications/visit-alert";

export interface SignInAlertInput {
  email: string;
  isNewUser: boolean;
  city: string | null;
  region: string | null;
  country: string | null;
  userAgent: string | null;
  createdAt: number;
  siteUrl?: string | null;
}

export interface SignInAlert {
  subject: string;
  html: string;
  text: string;
}

/**
 * Production only by default, like visit alerts: every environment shares one
 * database, so a sign-in on a local or preview build is not news.
 */
export function signInAlertsEnabled(env: {
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

export function shouldAlertSignIn(input: {
  enabled: boolean;
  email: string | null | undefined;
  isAuthor: boolean;
}): boolean {
  return input.enabled && Boolean(input.email) && !input.isAuthor;
}

export function buildSignInAlert(input: SignInAlertInput): SignInAlert {
  const subject = input.isNewUser
    ? `🔑 ${input.email} signed in for the first time`
    : `🔑 ${input.email} just signed in`;
  const intro = input.isNewUser
    ? "Someone signed in for the first time."
    : "Someone just signed in.";

  const details: [string, string][] = [
    ["Who", input.email],
    ["When", formatEt(input.createdAt)],
    ["Where", `${describeLocation(input)} (approx, from IP)`],
    ["Device", describeDevice(input.userAgent)],
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
