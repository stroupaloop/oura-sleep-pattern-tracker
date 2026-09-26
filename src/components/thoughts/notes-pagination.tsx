import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PageModel } from "@/lib/pagination";

export function NotesPagination({
  page,
  basePath = "/dashboard",
}: {
  page: PageModel;
  basePath?: string;
}) {
  if (page.pageCount <= 1) return null;

  const href = (n: number) => (n <= 1 ? basePath : `${basePath}?page=${n}`);

  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <span className="text-xs text-muted-foreground tabular-nums">
        {page.from}–{page.to} of {page.total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          asChild={page.hasPrev}
          variant="ghost"
          size="sm"
          disabled={!page.hasPrev}
          className="gap-1 text-muted-foreground"
        >
          {page.hasPrev ? (
            <Link href={href(page.page - 1)} scroll={false}>
              <ChevronLeft className="size-3.5" />
              Newer
            </Link>
          ) : (
            <span>
              <ChevronLeft className="size-3.5" />
              Newer
            </span>
          )}
        </Button>
        <Button
          asChild={page.hasNext}
          variant="ghost"
          size="sm"
          disabled={!page.hasNext}
          className="gap-1 text-muted-foreground"
        >
          {page.hasNext ? (
            <Link href={href(page.page + 1)} scroll={false}>
              Older
              <ChevronRight className="size-3.5" />
            </Link>
          ) : (
            <span>
              Older
              <ChevronRight className="size-3.5" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
