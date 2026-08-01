import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, isSensitiveUser } from "@/lib/auth";
import { MobileNav } from "@/components/mobile-nav";
import { db } from "@/lib/db";
import { syncLog } from "@/lib/db/schema";
import { desc, ne } from "drizzle-orm";
import { selectLatestDashboardSyncAttempt } from "@/lib/oura/freshness";

function formatAttemptStatus(status: string): string {
  if (status === "success") return "Attempt complete";
  if (status === "partial") return "Attempt partial";
  if (status === "error") return "Attempt failed";
  return "Attempt status unknown";
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sensitive = isSensitiveUser(session.user.email);

  const recentSyncRows = await db
    .select({
      syncType: syncLog.syncType,
      status: syncLog.status,
      errorMessage: syncLog.errorMessage,
      createdAt: syncLog.createdAt,
    })
    .from(syncLog)
    .where(ne(syncLog.syncType, "cron-hr"))
    .orderBy(desc(syncLog.createdAt))
    .limit(100)
    .catch(() => []);
  const lastSyncAttempt = selectLatestDashboardSyncAttempt(
    recentSyncRows,
    sensitive
  );
  const lastSyncTime = lastSyncAttempt
    ? new Date(lastSyncAttempt.attemptedAt * 1000).toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;
  const syncChannel =
    lastSyncAttempt?.channel === "private" ? "Private Oura" : "Oura";
  const syncCopy =
    lastSyncAttempt && lastSyncTime
      ? `${formatAttemptStatus(lastSyncAttempt.status)} · ${syncChannel} · ${lastSyncTime} ET`
      : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNav email={session.user.email} isSensitive={sensitive} />
          <div className="min-w-0">
            <Link href="/dashboard" className="block truncate font-semibold">
              🦥 Slothie&apos;s Bipolar Tracker
            </Link>
            {syncCopy && (
              <Link
                href="/dashboard/settings"
                className="block text-xs leading-snug text-muted-foreground sm:hidden"
              >
                {syncCopy}
              </Link>
            )}
          </div>
        </div>
        {syncCopy && (
          <Link
            href="/dashboard/settings"
            className="hidden text-xs text-muted-foreground hover:text-foreground sm:inline"
          >
            {syncCopy}
          </Link>
        )}
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
      <footer className="border-t px-4 md:px-6 py-3 text-xs text-muted-foreground">
        This tool tracks sleep patterns for personal awareness. It is not a
        medical device and does not provide diagnoses. Discuss concerns with
        your healthcare provider.{" "}
        <Link
          href="/dashboard/methodology"
          className="underline hover:text-foreground"
        >
          Learn about our approach
        </Link>
        .
      </footer>
    </div>
  );
}
