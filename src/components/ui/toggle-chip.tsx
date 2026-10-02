import { cn } from "@/lib/utils";

/**
 * An on/off choice among peers (tags, filters, a dose slot). Rose when on,
 * a hairline when off; the pressed state is announced, not just colored.
 */
export function ToggleChip({
  pressed,
  className,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & { pressed: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border px-3 text-sm transition-colors sm:min-h-8",
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}
