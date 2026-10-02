export const dynamic = "force-dynamic";

import Link from "next/link";
import { Activity, Eye } from "lucide-react";
import { auth } from "@/lib/auth";
import { isAuthorEmail } from "@/lib/access";
import { getTodayET } from "@/lib/date-utils";
import { loadDailyLog } from "@/lib/daily-log-data";
import { loadThoughtOverview, loadTimeline } from "@/lib/thoughts-page-data";
import { loadRecentReactions } from "@/lib/reactions";
import { buildPageModel } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { DailyLogCard } from "@/components/daily-log-card";
import { StatTiles } from "@/components/thoughts/stat-tiles";
import { ThoughtGrid } from "@/components/thoughts/thought-grid";
import { ThoughtComposer } from "@/components/thoughts/thought-composer";
import { ThoughtTimeline } from "@/components/thoughts/thought-timeline";
import { EditableThoughtTimeline } from "@/components/thoughts/editable-thought-timeline";
import { NotesPagination } from "@/components/thoughts/notes-pagination";
import { PageHeader } from "@/components/page-header";

/**
 * The signed-in home, in two halves: the thoughts written to her, and the
 * day's log, which both of them can fill in. The surrounding layout already
 * enforces authentication.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [session, params] = await Promise.all([auth(), searchParams]);
  const isAuthor = isAuthorEmail(session?.user?.email);
  const today = getTodayET();

  const [overview, dailyLog] = await Promise.all([
    loadThoughtOverview(),
    loadDailyLog(today),
  ]);
  const page = buildPageModel(params.page, overview.total);
  const viewerEmail = session?.user?.email ?? null;
  const [timeline, recents] = await Promise.all([
    loadTimeline(page.limit, page.offset),
    !isAuthor && viewerEmail ? loadRecentReactions(viewerEmail) : [],
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-8">
      <div className="min-w-0 space-y-5">
        <PageHeader
          title="Thinking of you"
          description="Every time you crossed my mind, and when."
          actions={
            <>
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
            </>
          }
        />

        <StatTiles
          total={overview.total}
          thisWeek={overview.thisWeek}
          streak={overview.streak}
          lastThought={overview.lastThought}
          compact
        />

        <ThoughtGrid grid={overview.grid} />

        {isAuthor && <ThoughtComposer />}

        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Every time
          </h2>
          {isAuthor ? (
            <EditableThoughtTimeline entries={timeline} />
          ) : (
            <ThoughtTimeline
              // Which pings were automatic stays with the author.
              entries={timeline.map((entry) => ({ ...entry, isAuto: undefined }))}
              viewerEmail={viewerEmail}
              recents={recents}
            />
          )}
          <NotesPagination page={page} />
        </section>
      </div>

      {/* She mostly opens this on her phone, so the log comes first there; on
          a wide screen it sits beside the thoughts and stays in view. */}
      <aside className="order-first lg:sticky lg:top-6 lg:order-none lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <DailyLogCard
          initialDay={today}
          medications={dailyLog.medications}
          initialMood={dailyLog.mood}
          initialMedLogs={dailyLog.medLogs}
          dense
        />
      </aside>
    </div>
  );
}
