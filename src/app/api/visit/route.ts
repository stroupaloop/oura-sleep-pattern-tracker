import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteVisits } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { getAuthorEmail, isAuthorEmail } from "@/lib/access";
import { getTodayET } from "@/lib/date-utils";
import { decideAlert, isProductionDeployment } from "@/lib/visit-alert-policy";
import { buildVisitAlert } from "@/lib/notifications/visit-alert";
import { sendEmail } from "@/lib/notifications/email";

const VISITOR_COOKIE = "sv_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const DEFAULT_WINDOW_MINUTES = 30;

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function clean(value: string | null, maxLength = 512): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, maxLength);
}

function onProduction(): boolean {
  return isProductionDeployment({
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  });
}

/**
 * Visit logging is off anywhere but the production deployment: every
 * environment shares one Turso database, so a local page load or a preview
 * deploy would otherwise write real rows and send a real alert.
 */
function trackingEnabled(): boolean {
  if (onProduction()) return true;
  return process.env.VISIT_TRACK_DEV === "1";
}

function alertsEnabled(): boolean {
  const flag = process.env.VISIT_ALERTS_ENABLED;
  if (flag === "0") return false;
  if (flag === "1") return true;
  return onProduction();
}

function alertWindowMinutes(): number {
  const raw = Number(process.env.VISIT_ALERT_WINDOW_MIN);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_WINDOW_MINUTES;
}

export async function POST(req: NextRequest) {
  if (!trackingEnabled()) {
    return NextResponse.json({ tracked: false, reason: "disabled" });
  }

  const existingVisitorId = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId =
    existingVisitorId && /^[0-9a-f-]{8,64}$/i.test(existingVisitorId)
      ? existingVisitorId
      : crypto.randomUUID();

  const response = NextResponse.json({ tracked: true });
  if (visitorId !== existingVisitorId) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const path = clean((body as { path?: string } | null)?.path ?? null, 256) ?? "/";

    const session = await auth();
    const email = session?.user?.email ?? null;
    const isAuthed = Boolean(session?.user);

    const headers = req.headers;
    const userAgent = clean(headers.get("user-agent"), 1024);
    const now = Math.floor(Date.now() / 1000);

    const [priorStats, lastAlerted] = await Promise.all([
      db
        .select({ visits: sql<number>`count(*)` })
        .from(siteVisits)
        .where(eq(siteVisits.visitorId, visitorId))
        .then((rows) => Number(rows[0]?.visits ?? 0)),
      db
        .select({ createdAt: siteVisits.createdAt })
        .from(siteVisits)
        .where(
          and(eq(siteVisits.visitorId, visitorId), eq(siteVisits.alerted, 1))
        )
        .orderBy(desc(siteVisits.createdAt))
        .limit(1)
        .then((rows) => rows[0]?.createdAt ?? null),
    ]);

    const decision = decideAlert({
      enabled: alertsEnabled(),
      isAuthor: isAuthorEmail(email),
      userAgent,
      lastAlertedAt: lastAlerted,
      now,
      windowMinutes: alertWindowMinutes(),
    });

    const visit = {
      day: getTodayET(),
      visitorId,
      path,
      email,
      isAuthed: isAuthed ? 1 : 0,
      ip: firstHeaderValue(headers.get("x-forwarded-for")),
      city: clean(headers.get("x-vercel-ip-city"), 128),
      region: clean(headers.get("x-vercel-ip-country-region"), 128),
      country: clean(headers.get("x-vercel-ip-country"), 8),
      userAgent,
      referrer: clean(headers.get("referer"), 512),
      alerted: decision.alert ? 1 : 0,
      createdAt: now,
    };

    await db.insert(siteVisits).values(visit);

    if (decision.alert) {
      const recipient = process.env.VISIT_ALERT_TO ?? getAuthorEmail();
      if (recipient) {
        const alert = buildVisitAlert({
          email,
          isAuthed,
          visitorId,
          visitNumber: priorStats + 1,
          path,
          city: visit.city,
          region: visit.region,
          country: visit.country,
          referrer: visit.referrer,
          userAgent,
          createdAt: now,
          siteUrl: process.env.NEXTAUTH_URL ?? null,
        });
        // A failed alert must not fail the visit log.
        await sendEmail(recipient, alert.subject, alert.html).catch((error) => {
          console.error("Failed to send visit alert:", error);
        });
      }
    }

    return response;
  } catch (error) {
    console.error("Failed to record visit:", error);
    const failed = NextResponse.json({ tracked: false }, { status: 500 });
    // Keep the visitor id even if the write failed, so the next visit is not
    // counted as a brand-new visitor.
    for (const cookie of response.cookies.getAll()) {
      failed.cookies.set(cookie);
    }
    return failed;
  }
}
