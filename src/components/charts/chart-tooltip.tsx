import { cn } from "@/lib/utils";

/** The surface every custom Recharts tooltip sits on. */
export function ChartTooltipFrame({
  title,
  className,
  children,
}: {
  title?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md",
        className
      )}
    >
      {title && <p className="mb-1 font-medium tabular-nums">{title}</p>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

/**
 * One line of a tooltip. The series color is a swatch; the words stay in
 * readable text, since stage and series hues fall under 4.5:1 as text.
 */
export function ChartTooltipRow({
  color,
  label,
  value,
  muted = false,
}: {
  color?: string;
  label: React.ReactNode;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-2 tabular-nums",
        muted && "text-muted-foreground"
      )}
    >
      {color && (
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: color }}
        />
      )}
      <span className={cn(!muted && "text-muted-foreground")}>{label}</span>
      <span className="ml-auto pl-3 font-medium">{value}</span>
    </p>
  );
}
