import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { headers } from "next/headers";
import { sendEmail } from "@/lib/notifications/email";
import { buildSignInEmail } from "@/lib/notifications/signin-email";
import {
  buildSignInAlert,
  shouldAlertSignIn,
  signInAlertsEnabled,
} from "@/lib/notifications/signin-alert";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import {
  getAllowedEmails,
  getAuthorEmail,
  isAuthorEmail,
  isSensitiveEmail,
  isPrimarySensitiveEmail,
} from "@/lib/access";

function getAdapter() {
  if (!db) throw new Error("Database not initialized – check TURSO_DATABASE_URL");
  return DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
}

export function isSensitiveUser(email: string | null | undefined): boolean {
  return isSensitiveEmail(email);
}

export function isPrimarySensitiveUser(
  email: string | null | undefined
): boolean {
  return isPrimarySensitiveEmail(email);
}

async function requestHeadersOrNull() {
  try {
    return await headers();
  } catch {
    return null;
  }
}

function headerValue(
  source: { get(name: string): string | null } | null,
  name: string
): string | null {
  const value = source?.get(name)?.trim();
  return value ? value : null;
}

/**
 * Emails the author when anyone else signs in. Visit alerts cannot stand in
 * for this: their per-visitor throttle swallows a signed-in visit that follows
 * an anonymous one inside the window.
 */
async function sendSignInAlert(
  email: string | null | undefined,
  isNewUser: boolean
) {
  const enabled = signInAlertsEnabled({
    flag: process.env.SIGNIN_ALERTS_ENABLED,
    vercelEnv: process.env.VERCEL_ENV,
    nodeEnv: process.env.NODE_ENV,
  });
  if (!shouldAlertSignIn({ enabled, email, isAuthor: isAuthorEmail(email) })) {
    return;
  }
  const recipient = process.env.VISIT_ALERT_TO ?? getAuthorEmail();
  if (!email || !recipient) return;

  // The event fires inside the magic-link callback request, so these are the
  // headers of the browser that opened the link.
  const requestHeaders = await requestHeadersOrNull();
  const alert = buildSignInAlert({
    email,
    isNewUser,
    city: headerValue(requestHeaders, "x-vercel-ip-city"),
    region: headerValue(requestHeaders, "x-vercel-ip-country-region"),
    country: headerValue(requestHeaders, "x-vercel-ip-country"),
    userAgent: headerValue(requestHeaders, "user-agent"),
    createdAt: Math.floor(Date.now() / 1000),
    siteUrl: process.env.NEXTAUTH_URL ?? null,
  });
  await sendEmail(recipient, alert.subject, alert.html, { text: alert.text });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: process.env.TURSO_DATABASE_URL ? getAdapter() : undefined,
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "noreply@resend.dev",
      // Replaces Auth.js's default link-only template, which scores badly
      // as spam coming from a low-volume sender.
      async sendVerificationRequest({ identifier, url }) {
        const { host } = new URL(url);
        const { subject, html, text } = buildSignInEmail({ url, host });
        await sendEmail(identifier, subject, html, {
          text,
          headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
        });
      },
    }),
  ],
  callbacks: {
    signIn({ user }) {
      if (!user.email) return false;
      const allowedEmails = getAllowedEmails();
      if (allowedEmails.length === 0) {
        return process.env.NODE_ENV !== "production";
      }
      return allowedEmails.includes(user.email.toLowerCase());
    },
  },
  events: {
    async signIn({ user, isNewUser }) {
      // A failed alert must not fail the sign-in.
      await sendSignInAlert(user.email, Boolean(isNewUser)).catch((error) => {
        console.error("Failed to send sign-in alert:", error);
      });
    },
  },
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/login?verify=1",
    error: "/login",
  },
  debug: process.env.NODE_ENV !== "production",
});
