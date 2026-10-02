import { MoonStar } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Last night's absence, said plainly with the reason and the fix, so a gap
 * never reads as a quiet night.
 */
export function MissingNightNotice({
  morning,
  canSync,
  hasEarlierNight,
  className,
}: {
  morning: boolean;
  canSync: boolean;
  hasEarlierNight: boolean;
  className?: string;
}) {
  const title = morning
    ? "Last night isn't here yet"
    : "No sleep recorded for last night";
  const reason = morning
    ? "Oura receives it once the Oura app on the phone syncs the ring."
    : "If the ring was worn, opening the Oura app on the phone syncs it.";
  const next = canSync ? " Then tap Sync now." : "";
  const earlier = hasEarlierNight ? " Below is the latest night on record." : "";

  return (
    <div
      role="status"
      className={cn(
        "flex gap-3 rounded-xl border border-watch/25 bg-watch/8 p-4",
        className
      )}
    >
      <MoonStar aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-watch" />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">
          {reason}
          {next}
          {earlier}
        </p>
      </div>
    </div>
  );
}
