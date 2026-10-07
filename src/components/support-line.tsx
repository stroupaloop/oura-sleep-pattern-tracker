import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { SUPPORT_LINE } from "@/lib/support-line";
import { cn } from "@/lib/utils";

function SupportActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button asChild variant="outline" size="sm">
        <a href={SUPPORT_LINE.callHref}>Call {SUPPORT_LINE.number}</a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={SUPPORT_LINE.textHref}>Text {SUPPORT_LINE.number}</a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={SUPPORT_LINE.chatHref} target="_blank" rel="noopener noreferrer">
          Chat online
        </a>
      </Button>
    </div>
  );
}

const SUPPORT_COPY =
  "You can call or text 988, the Suicide & Crisis Lifeline in the US, at any time. In an emergency, call 911.";

/** A page-level notice, for pages where a lower or mixed pattern is on screen. */
export function SupportLine({ className }: { className?: string }) {
  return (
    <section aria-label="Support" className={className}>
      <Callout
        icon={LifeBuoy}
        title="If you feel unsafe or are thinking about hurting yourself"
      >
        <p>{SUPPORT_COPY}</p>
        <SupportActions className="mt-3" />
      </Callout>
    </section>
  );
}

/** The same help inside a panel, where a Callout would nest. */
export function SupportNote({ className }: { className?: string }) {
  return (
    <div
      aria-label="Support"
      className={cn("space-y-2 text-sm text-muted-foreground", className)}
    >
      <p>
        <span className="font-medium text-foreground">
          If you feel unsafe or are thinking about hurting yourself.
        </span>{" "}
        {SUPPORT_COPY}
      </p>
      <SupportActions />
    </div>
  );
}
