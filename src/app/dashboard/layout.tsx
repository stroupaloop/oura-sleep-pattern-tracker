import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { MobileNav } from "@/components/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MobileNav email={session.user.email} />
          <Link href="/dashboard" className="font-semibold">
            Slothie&apos;s Bipolar Tracker
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Overview
          </Link>
          <Link
            href="/dashboard/sleep"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sleep
          </Link>
          <Link
            href="/dashboard/insights"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Insights
          </Link>
          <Link
            href="/dashboard/lifechart"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Life Chart
          </Link>
          <Link
            href="/dashboard/alerts"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Alerts
          </Link>
          <Link
            href="/dashboard/settings"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Settings
          </Link>
        </nav>
        <span className="hidden md:block text-sm text-muted-foreground">
          {session.user.email}
        </span>
      </header>
      <main className="flex-1 p-4 md:p-6">{children}</main>
      <footer className="border-t px-4 md:px-6 py-3 text-xs text-muted-foreground">
        This tool tracks sleep patterns for personal awareness. It is not a
        medical device and does not provide diagnoses. Discuss concerns with
        your healthcare provider.
      </footer>
    </div>
  );
}
