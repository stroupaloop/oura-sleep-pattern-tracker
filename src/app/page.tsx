export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  loadNotePreviews,
  loadThoughtOverview,
} from "@/lib/thoughts-page-data";
import { Button } from "@/components/ui/button";
import { StatTiles } from "@/components/thoughts/stat-tiles";
import { ThoughtGrid } from "@/components/thoughts/thought-grid";
import { SignInTease } from "@/components/thoughts/sign-in-tease";
import { VisitBeacon } from "@/components/thoughts/visit-beacon";

/**
 * The public face of the site. Identical for everyone: counts and the grid,
 * never the notes and never the compose controls. Signing in does not change
 * what is rendered here, it only adds a way through to the dashboard, so what
 * you see is exactly what she sees.
 */
export default async function Home() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  const [overview, previews] = await Promise.all([
    loadThoughtOverview(),
    loadNotePreviews(),
  ]);

  return (
    <div className="min-h-screen px-4 py-10 md:py-16">
      <VisitBeacon path="/" />

      <div className="mx-auto flex max-w-3xl justify-end">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Link href={signedIn ? "/dashboard" : "/login"}>
            {signedIn ? "Open dashboard →" : "Sign in"}
          </Link>
        </Button>
      </div>

      <main className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <span className="text-5xl">🦥</span>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Thinking of you
          </h1>
          <p className="text-sm text-muted-foreground">
            Every time you crossed my mind, and when.
          </p>
        </header>

        <StatTiles
          total={overview.total}
          thisWeek={overview.thisWeek}
          streak={overview.streak}
          lastThought={overview.lastThought}
        />

        <ThoughtGrid grid={overview.grid} />

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            There&apos;s more to these
          </h2>
          <SignInTease noteCount={overview.noteCount} previews={previews} />
        </section>
      </main>

      <footer className="mx-auto mt-16 max-w-3xl space-x-4 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
