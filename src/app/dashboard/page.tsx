export const dynamic = "force-dynamic";

import Link from "next/link";
import { auth } from "@/lib/auth";
import { isAuthorEmail } from "@/lib/access";
import {
  loadThoughtOverview,
  loadTimeline,
} from "@/lib/thoughts-page-data";
import { Button } from "@/components/ui/button";
import { StatTiles } from "@/components/thoughts/stat-tiles";
import { ThoughtGrid } from "@/components/thoughts/thought-grid";
import { ThoughtComposer } from "@/components/thoughts/thought-composer";
import { ThoughtTimeline } from "@/components/thoughts/thought-timeline";
import { EditableThoughtTimeline } from "@/components/thoughts/editable-thought-timeline";

/**
 * The signed-in home. Everything gated lives here: the compose controls for
 * the author, and the note contents for anyone allowed to sign in. The
 * surrounding layout already enforces authentication.
 */
export default async function DashboardPage() {
  const session = await auth();
  const isAuthor = isAuthorEmail(session?.user?.email);

  const overview = await loadThoughtOverview();
  const timeline = await loadTimeline(overview.windowStart);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Thinking of you
        </h1>
        <p className="text-sm text-muted-foreground">
          Every time she crossed your mind, and when.
        </p>
      </div>

      <StatTiles
        total={overview.total}
        thisWeek={overview.thisWeek}
        streak={overview.streak}
        lastThought={overview.lastThought}
      />

      <ThoughtGrid grid={overview.grid} total={overview.total} />

      {isAuthor && <ThoughtComposer />}

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">The notes</h2>
        {isAuthor ? (
          <EditableThoughtTimeline entries={timeline} />
        ) : (
          <ThoughtTimeline entries={timeline} />
        )}
      </section>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/health">Health dashboard →</Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
          <Link href="/">View the public page</Link>
        </Button>
      </div>
    </div>
  );
}
