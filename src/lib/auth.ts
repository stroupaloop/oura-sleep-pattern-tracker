import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import {
  getAllowedEmails,
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

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: process.env.TURSO_DATABASE_URL ? getAdapter() : undefined,
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "noreply@resend.dev",
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
