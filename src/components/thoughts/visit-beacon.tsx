"use client";

import { useEffect, useRef } from "react";

/**
 * Records one visit per page load. Kept client-side so the cookie can be set
 * and so obvious crawlers (which do not run scripts) drop out on their own.
 */
export function VisitBeacon({ path }: { path: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {
      // A failed beacon must never affect the page.
    });
  }, [path]);

  return null;
}
