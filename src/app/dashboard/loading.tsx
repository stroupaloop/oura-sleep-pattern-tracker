/** Placeholder blocks in the shape of a page while it loads; no spinner. */
export default function DashboardLoading() {
  return (
    <div
      className="mx-auto max-w-6xl space-y-6"
      role="status"
      aria-label="Loading"
    >
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      </div>
      {[0, 1, 2].map((block) => (
        <div
          key={block}
          className="h-40 animate-pulse rounded-xl border bg-card motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
