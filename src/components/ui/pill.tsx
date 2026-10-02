import { cn } from "@/lib/utils";
import { TONE_STYLES, type Tone } from "./callout";

/** A short status word. One per row at most; the words carry the meaning. */
export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_STYLES[tone].pill,
        className
      )}
    >
      {children}
    </span>
  );
}
