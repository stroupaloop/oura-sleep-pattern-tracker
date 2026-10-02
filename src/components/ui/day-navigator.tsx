import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Previous and next around a day label, with phone-sized targets. */
export function DayNavigator({
  label,
  onPrevious,
  onNext,
  previousDisabled,
  nextDisabled,
  previousLabel = "Previous day",
  nextLabel = "Next day",
  className,
}: {
  /** The current day; may hold a date input for jumping. */
  label: React.ReactNode;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onPrevious}
        disabled={previousDisabled}
        aria-label={previousLabel}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <div className="min-w-0 text-center text-sm font-medium tabular-nums">
        {label}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={nextLabel}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
