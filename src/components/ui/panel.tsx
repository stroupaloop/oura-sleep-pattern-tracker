import { cn } from "@/lib/utils";

/** A titled region of the Health page: one surface, never nested in another. */
export function Panel({
  id,
  title,
  description,
  meta,
  className,
  children,
}: {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-xl border bg-card p-4 md:p-5", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={id} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        {meta && (
          <div className="text-xs text-muted-foreground tabular-nums">{meta}</div>
        )}
      </div>
      {description && (
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
