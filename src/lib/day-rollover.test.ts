import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchDayRollover } from "./day-rollover";

function makeEnv() {
  const doc = Object.assign(new EventTarget(), {
    visibilityState: "visible" as DocumentVisibilityState,
    activeElement: null as { tagName: string } | null,
  });
  const win = new EventTarget();
  return {
    doc,
    win,
    env: { document: doc as unknown as Document, window: win },
  };
}

describe("watchDayRollover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing while the ET day still matches the rendered day", () => {
    // 11:30 PM ET on Sep 27.
    vi.setSystemTime(new Date("2026-09-28T03:30:00Z"));
    const { win, env } = makeEnv();
    const onRollover = vi.fn();

    watchDayRollover("2026-09-27", onRollover, env);
    win.dispatchEvent(new Event("focus"));

    expect(onRollover).not.toHaveBeenCalled();
  });

  it("refreshes when a page from last night is resumed the next morning", () => {
    vi.setSystemTime(new Date("2026-09-28T03:30:00Z"));
    const { doc, win, env } = makeEnv();
    const onRollover = vi.fn();
    watchDayRollover("2026-09-27", onRollover, env);

    doc.visibilityState = "hidden";
    // 7:05 AM ET on Sep 28.
    vi.setSystemTime(new Date("2026-09-28T11:05:00Z"));
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    win.dispatchEvent(new Event("focus"));
    win.dispatchEvent(new Event("pageshow"));

    expect(onRollover).toHaveBeenCalledTimes(1);
  });

  it("refreshes on mount when the page was rendered for an earlier day", () => {
    vi.setSystemTime(new Date("2026-09-28T11:05:00Z"));
    const { env } = makeEnv();
    const onRollover = vi.fn();

    watchDayRollover("2026-09-27", onRollover, env);

    expect(onRollover).toHaveBeenCalledTimes(1);
  });

  it("waits while a note is being typed, then rolls over on the next resume", () => {
    vi.setSystemTime(new Date("2026-09-28T11:05:00Z"));
    const { doc, win, env } = makeEnv();
    doc.activeElement = { tagName: "TEXTAREA" };
    const onRollover = vi.fn();

    watchDayRollover("2026-09-27", onRollover, env);
    expect(onRollover).not.toHaveBeenCalled();

    doc.activeElement = null;
    win.dispatchEvent(new Event("focus"));
    expect(onRollover).toHaveBeenCalledTimes(1);
  });

  it("stops listening once cleaned up", () => {
    vi.setSystemTime(new Date("2026-09-28T03:30:00Z"));
    const { win, env } = makeEnv();
    const onRollover = vi.fn();
    const stop = watchDayRollover("2026-09-27", onRollover, env);

    stop();
    vi.setSystemTime(new Date("2026-09-28T11:05:00Z"));
    win.dispatchEvent(new Event("focus"));

    expect(onRollover).not.toHaveBeenCalled();
  });
});
