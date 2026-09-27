"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** The path to record now, or null when it is the one just recorded. */
export function nextBeaconPath(
  lastSent: string | null,
  current: string
): string | null {
  return current === lastSent ? null : current;
}

/**
 * Records one visit per page. Kept client-side so the cookie can be set and so
 * obvious crawlers (which do not run scripts) drop out on their own. Without a
 * fixed path it follows the route, so one beacon in a layout also records the
 * pages reached by client-side navigation.
 */
export function VisitBeacon({ path }: { path?: string }) {
  const pathname = usePathname();
  const current = path ?? pathname;
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    const next = nextBeaconPath(lastSent.current, current);
    if (!next) return;
    lastSent.current = next;

    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: next }),
      keepalive: true,
    }).catch(() => {
      // A failed beacon must never affect the page.
    });
  }, [current]);

  return null;
}
