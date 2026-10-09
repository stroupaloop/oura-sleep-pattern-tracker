import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TONE_STYLES } from "@/components/ui/callout";
import type { EpisodePatternSummary } from "@/lib/episode-pattern";
import { PatternStatus } from "./pattern-status";

const TODAY = "2026-10-02";

function flagged(
  overrides: Partial<EpisodePatternSummary> = {}
): EpisodePatternSummary {
  return {
    tier: "warning",
    direction: "hyper",
    flaggedDays: 3,
    lastFlaggedDay: "2026-10-01",
    eased: false,
    ...overrides,
  };
}

function render(props: Partial<ComponentProps<typeof PatternStatus>> = {}) {
  return renderToStaticMarkup(
    <PatternStatus
      pattern={null}
      latestCheckedDay="2026-10-01"
      paused={false}
      today={TODAY}
      {...props}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PatternStatus flagged", () => {
  it("names the tier, the count and the direction of a flag", () => {
    const html = render({ pattern: flagged() });
    expect(html).toContain("Warning: 3 flagged days in the last 14 days");
    expect(html).toContain("Higher-activation personal-baseline pattern");
    expect(html).toContain("not a mood-episode diagnosis");
    expect(html).toContain('href="/dashboard/alerts"');
    expect(html).toContain(TONE_STYLES.attention.surface);
    expect(html).not.toContain("behind");
  });

  it("says the check is behind beneath a flag instead of letting it pass for current", () => {
    const html = render({
      pattern: flagged(),
      latestCheckedDay: "2026-09-29",
      canSync: true,
    });
    expect(html).toContain("Warning: 3 flagged days in the last 14 days");
    expect(html).toContain(
      "The check is behind: it last ran through the night of Sep 28 → Sep 29. Open the Oura app to sync, then tap Sync now."
    );
  });

  it("does not offer a button the viewer lacks", () => {
    const html = render({
      pattern: flagged(),
      latestCheckedDay: "2026-09-29",
    });
    expect(html).toContain(
      "It catches up once the Oura app on the phone syncs the ring."
    );
    expect(html).not.toContain("Sync now");
  });

  it("stays a flag when the day last checked is not known", () => {
    const html = render({ pattern: flagged(), latestCheckedDay: null });
    expect(html).toContain("Warning: 3 flagged days in the last 14 days");
    expect(html).not.toContain("behind");
  });
});

describe("PatternStatus eased", () => {
  const eased = flagged({ eased: true, lastFlaggedDay: "2026-09-29" });

  it("says when it was last flagged, without the tier's tint", () => {
    const html = render({
      pattern: eased,
      latestCheckedDay: "2026-10-02",
    });
    expect(html).toContain("Pattern flag has eased");
    expect(html).toContain(
      "Last flagged the night of Sep 28 → Sep 29; the latest nights are back near usual."
    );
    expect(html).toContain(
      "3 flagged days in the last 14 days. Checked through the night of Oct 1 → Oct 2."
    );
    expect(html).toContain('href="/dashboard/alerts"');
    expect(html).toContain(TONE_STYLES.neutral.surface);
    expect(html).not.toContain(TONE_STYLES.attention.surface);
    expect(html).not.toContain("Warning");
    expect(html).not.toContain("text-calm");
  });

  it("counts a single flagged day in the singular and skips an unknown check date", () => {
    const html = render({
      pattern: flagged({ eased: true, flaggedDays: 1 }),
      latestCheckedDay: null,
    });
    expect(html).toContain("1 flagged day in the last 14 days.");
    expect(html).not.toContain("Checked through");
  });

  it("yields to a check that is paused or behind", () => {
    const paused = render({ pattern: eased, paused: true });
    expect(paused).toContain("Pattern checks are paused");
    expect(paused).not.toContain("has eased");

    const behind = render({
      pattern: flagged({ eased: true, lastFlaggedDay: "2026-09-25" }),
      latestCheckedDay: "2026-09-29",
    });
    expect(behind).toContain("Pattern check is behind");
    expect(behind).toContain(
      "A pattern was last flagged the night of Sep 24 → Sep 25."
    );
    expect(behind).not.toContain("has eased");
  });
});

describe("PatternStatus clear", () => {
  it("says when the check last ran when nothing is flagged", () => {
    const html = render();
    expect(html).toContain("No pattern flags in the last 14 days");
    expect(html).toContain("Checked through the night of Sep 30 → Oct 1.");
    expect(html).toContain("text-calm");
    expect(html).not.toContain("behind");
  });

  it("counts a check through today as current too", () => {
    const html = render({ latestCheckedDay: TODAY });
    expect(html).toContain("No pattern flags in the last 14 days");
    expect(html).toContain("Checked through the night of Oct 1 → Oct 2.");
  });
});

describe("PatternStatus behind", () => {
  it("says the check is behind, with the night and the fix, instead of all clear", () => {
    const html = render({ latestCheckedDay: "2026-09-30", canSync: true });
    expect(html).toContain("Pattern check is behind");
    expect(html).toContain(
      "Last checked: the night of Sep 29 → Sep 30. Newer nights haven&#x27;t reached the app, so the last 14 days aren&#x27;t fully covered."
    );
    expect(html).toContain("Open the Oura app to sync, then tap Sync now.");
    expect(html).toContain(TONE_STYLES.info.surface);
    expect(html).not.toContain("No pattern flags");
    expect(html).not.toContain("text-calm");
  });

  it("leaves out the button for a viewer without it", () => {
    const html = render({ latestCheckedDay: "2026-09-30" });
    expect(html).toContain("Pattern check is behind");
    expect(html).toContain(
      "It catches up once the Oura app on the phone syncs the ring."
    );
    expect(html).not.toContain("Sync now");
  });

  it("is behind from two nights back, not from last night's", () => {
    expect(render({ latestCheckedDay: "2026-10-01" })).toContain(
      "No pattern flags in the last 14 days"
    );
    expect(render({ latestCheckedDay: "2026-09-30" })).toContain(
      "Pattern check is behind"
    );
    expect(render({ latestCheckedDay: "2026-10-31", today: "2026-11-01" })).toContain(
      "No pattern flags in the last 14 days"
    );
    expect(render({ latestCheckedDay: "2026-10-30", today: "2026-11-01" })).toContain(
      "Pattern check is behind"
    );
  });

  it("measures against today in Eastern time when no day is given", () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-10-03T02:30:00Z"));
    expect(
      renderToStaticMarkup(
        <PatternStatus pattern={null} latestCheckedDay="2026-10-01" paused={false} />
      )
    ).toContain("No pattern flags in the last 14 days");

    vi.setSystemTime(new Date("2026-10-03T05:30:00Z"));
    expect(
      renderToStaticMarkup(
        <PatternStatus pattern={null} latestCheckedDay="2026-10-01" paused={false} />
      )
    ).toContain("Pattern check is behind");
  });
});

describe("PatternStatus paused or not run", () => {
  it("says why checks are not running, ahead of being behind", () => {
    const html = render({ latestCheckedDay: "2026-09-02", paused: true });
    expect(html).toContain("Pattern checks are paused");
    expect(html).toContain(
      "They need new nights from Oura; reconnecting resumes them."
    );
    expect(html).not.toContain("behind");
    expect(html).not.toContain("text-calm");
  });

  it("does not put a check mark on checks that have not run", () => {
    const html = render({ latestCheckedDay: null });
    expect(html).toContain("Pattern checks haven&#x27;t run yet");
    expect(html).toContain("They start once there are 14 nights to compare with.");
    expect(html).not.toContain("text-calm");
  });
});
