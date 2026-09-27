export const dynamic = "force-dynamic";

import Link from "next/link";
import { Activity, Eye } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAuthorEmail } from "@/lib/access";
import { loadThoughtOverview, loadTimeline } from "@/lib/thoughts-page-data";
import { buildPageModel } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { StatTiles } from "@/components/thoughts/stat-tiles";
import { ThoughtGrid } from "@/components/thoughts/thought-grid";
import { ThoughtComposer } from "@/components/thoughts/thought-composer";
import { ThoughtTimeline } from "@/components/thoughts/thought-timeline";
import { EditableThoughtTimeline } from "@/components/thoughts/editable-thought-timeline";
import { NotesPagination } from "@/components/thoughts/notes-pagination";

/**
 * The signed-in home. Everything gated lives here: the compose controls for
 * the author, and the note contents for anyone allowed to sign in. The
 * surrounding layout already enforces authentication.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const isAuthor = isAuthorEmail(session?.user?.email);

  const overview = await loadThoughtOverview();
  const page = buildPageModel(params.page, overview.total);
  const timeline = await loadTimeline(page.limit, page.offset);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Thinking of you
          </h1>
          <p className="text-sm text-muted-foreground">
            Every time you crossed my mind, and when.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Link href="/dashboard/health">
              <Activity className="size-3.5" />
              Health
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Link href="/">
              <Eye className="size-3.5" />
              Public page
            </Link>
          </Button>
        </div>
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
        <h2 className="text-sm font-medium text-muted-foreground">
          Every time
        </h2>
        {isAuthor ? (
          <EditableThoughtTimeline entries={timeline} />
        ) : (
          <ThoughtTimeline entries={timeline} />
        )}
        <NotesPagination page={page} />
      </section>
    </div>
  );
}
