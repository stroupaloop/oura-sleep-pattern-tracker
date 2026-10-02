import { cn } from "@/lib/utils";

/** A labelled number: label above, value in tabular figures, note below. */
export function Stat({
  label,
  value,
  note,
  size = "md",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  note?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-semibold tracking-tight tabular-nums",
          size === "sm" && "text-sm",
          size === "md" && "text-xl",
          size === "lg" && "text-3xl"
        )}
      >
        {value}
      </p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
