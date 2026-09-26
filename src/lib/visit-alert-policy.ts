const BOT_PATTERNS = [
  "bot",
  "crawler",
  "spider",
  "slurp",
  "curl",
  "wget",
  "headlesschrome",
  "python-requests",
  "postman",
  "lighthouse",
  "preview",
  "monitor",
  "pingdom",
  "uptime",
];

export function isLikelyBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some((pattern) => ua.includes(pattern));
}

export type AlertSkipReason =
  | "disabled"
  | "author"
  | "bot"
  | "throttled"
  | null;

export interface AlertDecisionInput {
  enabled: boolean;
  isAuthor: boolean;
  userAgent: string | null;
  /** Unix seconds of the last visit from this visitor that triggered an alert. */
  lastAlertedAt: number | null;
  now: number;
  windowMinutes: number;
}

export interface AlertDecision {
  alert: boolean;
  reason: AlertSkipReason;
}

export function decideAlert(input: AlertDecisionInput): AlertDecision {
  if (!input.enabled) return { alert: false, reason: "disabled" };
  if (input.isAuthor) return { alert: false, reason: "author" };
  if (isLikelyBot(input.userAgent)) return { alert: false, reason: "bot" };
  if (
    input.lastAlertedAt !== null &&
    input.now - input.lastAlertedAt < input.windowMinutes * 60
  ) {
    return { alert: false, reason: "throttled" };
  }
  return { alert: true, reason: null };
}
