import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, isSensitiveUser } from "@/lib/auth";
import { MobileNav } from "@/components/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sensitive = isSensitiveUser(session.user.email);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MobileNav email={session.user.email} isSensitive={sensitive} />
          <Link href="/dashboard" className="font-semibold">
            🦥 Slothie&apos;s Bipolar Tracker
          </Link>
        </div>
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
