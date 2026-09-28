import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTodayET } from "@/lib/date-utils";

const MIN_REFRESH_GAP_MS = 60_000;

interface RolloverEnv {
  document: Pick<Document, "visibilityState" | "activeElement"> & EventTarget;
  window: EventTarget;
}

/**
 * Calls `onRollover` when the page comes back into view on a later ET day
 * than the one it was rendered for. Phones resume a tab without reloading
 * it, so a log opened last night would otherwise still show last night the
 * next morning. It only fires on resume, never mid-use, so a check-in being
 * filled in across midnight is not swept away.
 */
export function watchDayRollover(
  renderedDay: string,
  onRollover: () => void,
  env: RolloverEnv = { document, window }
): () => void {
  let lastRefreshAt = -Infinity;

  function check() {
    if (getTodayET() <= renderedDay) return;
    if (env.document.visibilityState !== "visible") return;
    // A half-typed note would be lost; the next resume picks the day up.
    if (env.document.activeElement?.tagName === "TEXTAREA") return;
    const now = Date.now();
    if (now - lastRefreshAt < MIN_REFRESH_GAP_MS) return;
    lastRefreshAt = now;
    onRollover();
  }

  env.document.addEventListener("visibilitychange", check);
  env.window.addEventListener("focus", check);
  env.window.addEventListener("pageshow", check);
  check();

  return () => {
    env.document.removeEventListener("visibilitychange", check);
    env.window.removeEventListener("focus", check);
    env.window.removeEventListener("pageshow", check);
  };
}

/** Re-fetches the page's server data once the ET day has moved on. */
export function useDayRollover(renderedDay: string) {
  const router = useRouter();
  useEffect(
    () => watchDayRollover(renderedDay, () => router.refresh()),
    [renderedDay, router]
  );
}
