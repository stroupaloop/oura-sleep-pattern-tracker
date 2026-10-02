import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/design/tone";

export type { Tone };

/** Surface, border and icon color for each tone; one meaning per hue. */
export const TONE_STYLES: Record<
  Tone,
  { surface: string; icon: string; text: string; pill: string }
> = {
  neutral: {
    surface: "border-border bg-card",
    icon: "text-muted-foreground",
    text: "text-muted-foreground",
    pill: "bg-muted text-muted-foreground ring-border",
  },
  info: {
    surface: "border-watch/25 bg-watch/8",
    icon: "text-watch",
    text: "text-watch",
    pill: "bg-watch/12 text-watch ring-watch/25",
  },
  attention: {
    surface: "border-attention/30 bg-attention/8",
    icon: "text-attention",
    text: "text-attention",
    pill: "bg-attention/12 text-attention ring-attention/25",
  },
  alert: {
    surface: "border-alert/30 bg-alert/8",
    icon: "text-alert",
    text: "text-alert",
    pill: "bg-alert/12 text-alert ring-alert/25",
  },
  calm: {
    surface: "border-calm/25 bg-calm/8",
    icon: "text-calm",
    text: "text-calm",
    pill: "bg-calm/12 text-calm ring-calm/25",
  },
};

/**
 * A notice inside the flow of a page: a title that names the situation and a
 * body that says what it means or what to do. Never nested in a Panel.
 */
export function Callout({
  tone = "neutral",
  icon: Icon,
  title,
  children,
  role,
  className,
}: {
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title?: React.ReactNode;
  children?: React.ReactNode;
  role?: "status" | "alert";
  className?: string;
}) {
  const style = TONE_STYLES[tone];
  return (
    <div
      role={role}
      className={cn("flex gap-3 rounded-xl border p-4", style.surface, className)}
    >
      {Icon && (
        <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", style.icon)} />
      )}
      <div className="min-w-0 space-y-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-muted-foreground">{children}</div>}
      </div>
    </div>
  );
}
