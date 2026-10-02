import { cn } from "@/lib/utils";

/**
 * The result of an action. Errors say what failed and what to do, are
 * announced at once, and use the destructive red; status is polite and muted.
 */
export function FormMessage({
  kind = "status",
  className,
  children,
}: {
  kind?: "status" | "error";
  className?: string;
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      className={cn(
        "text-sm",
        kind === "error" ? "text-destructive" : "text-muted-foreground",
        className
      )}
    >
      {children}
    </p>
  );
}
