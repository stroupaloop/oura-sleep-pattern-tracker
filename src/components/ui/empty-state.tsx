import { cn } from "@/lib/utils";

/**
 * In place of data that is not there: what is missing, why, and how to get
 * it. Never a bare "nothing here".
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center",
        className
      )}
    >
      {Icon && <Icon aria-hidden className="size-5 text-muted-foreground" />}
      <p className="text-sm font-medium">{title}</p>
      {children && (
        <div className="max-w-md text-sm text-muted-foreground">{children}</div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
