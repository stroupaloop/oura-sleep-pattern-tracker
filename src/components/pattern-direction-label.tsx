import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { describePatternDirection } from "@/lib/design/pattern-direction";

/** A pattern's direction as an arrow and words, in the text color around it. */
export function PatternDirectionLabel({
  direction,
  short = false,
  className,
}: {
  direction: string | null | undefined;
  short?: boolean;
  className?: string;
}) {
  const described = describePatternDirection(direction);
  const Arrow =
    described.arrow === "up" ? ArrowUp : described.arrow === "down" ? ArrowDown : null;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {Arrow && <Arrow aria-hidden="true" className="size-3.5" />}
      {short ? described.short : described.label}
    </span>
  );
}
