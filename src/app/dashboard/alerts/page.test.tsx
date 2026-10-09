import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PATTERN_ALGORITHM_VERSION,
  PATTERN_SIGNAL_MODE,
} from "@/lib/analysis/provenance";
import AlertsPage from "./page";

const state = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/dashboard/alerts",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  type Table = Parameters<typeof getTableName>[0];
  function from(table: Table) {
    const rows = () => Promise.resolve(state.rows[getTableName(table)] ?? []);
    const query = {
      where: () => query,
      orderBy: () => query,
      limit: () => query,
      then: (
        resolve: (value: unknown[]) => unknown,
        reject: (reason: unknown) => unknown
      ) => rows().then(resolve, reject),
    };
    return query;
  }
  return { db: { select: () => ({ from }) } };
});

function assessment(
  day: string,
  fields: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    day,
    tier: "none",
    direction: null,
    confidence: 1,
    bestWindowDays: 5,
    consecutiveConcerningDays: 0,
    primaryDrivers: "[]",
    researchContext: null,
    configVersion: 1,
    bipolarProfile: "unspecified",
    algorithmVersion: PATTERN_ALGORITHM_VERSION,
    signalMode: PATTERN_SIGNAL_MODE,
    evaluatedAt: null,
    createdAt: 0,
    ...fields,
  };
}

const STORED_CONTEXT = JSON.stringify({
  headline: "Your available data matched this app's pattern rule",
  whatWeDetected: ["Sleep duration decreased 45 min below your baseline"],
  whyItMatters: "",
  whatYouCanDo: [
    "Try to maintain regular sleep and wake times",
    "Consider light physical activity today",
    "Reach out to your care team if you notice changes",
  ],
  researchIds: [],
  confidence: "moderate",
  disclaimer: "",
});

async function renderAlerts(
  params: Record<string, string> = {}
): Promise<string> {
  return renderToStaticMarkup(
    await AlertsPage({ searchParams: Promise.resolve(params) })
  );
}

function flaggedRows(direction: string | null) {
  state.rows.episode_assessments = [
    assessment("2026-10-01", {
      tier: "watch",
      direction,
      confidence: 3,
      consecutiveConcerningDays: 2,
      researchContext: STORED_CONTEXT,
    }),
  ];
}

const originalSensitiveEmails = process.env.SENSITIVE_EMAILS;

describe("Alerts page", () => {
  beforeEach(() => {
    state.rows = {};
    delete process.env.SENSITIVE_EMAILS;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T15:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalSensitiveEmails === undefined) {
      delete process.env.SENSITIVE_EMAILS;
    } else {
      process.env.SENSITIVE_EMAILS = originalSensitiveEmails;
    }
  });

  it("dates the all-clear with the night the check ran through", async () => {
    state.rows.episode_assessments = [
      assessment("2026-10-01"),
      assessment("2026-09-30"),
    ];
    const html = await renderAlerts();
    expect(html).toContain("No sustained pattern flags from the available data");
    expect(html).toContain("Checked through the night of Sep 30 → Oct 1.");
    expect(html).not.toContain("Pattern check is behind");
  });

  it("says the check is behind instead of all clear when newer nights are missing", async () => {
    state.rows.episode_assessments = [
      assessment("2026-09-28"),
      assessment("2026-09-27"),
    ];
    const html = await renderAlerts();
    expect(html).toContain("Pattern check is behind");
    expect(html).toContain("Last checked: the night of Sep 27 → Sep 28");
    expect(html).not.toContain("No sustained pattern flags");
  });

  it("gives a flag with no clear direction the neutral advice, not the stored lower-activation list", async () => {
    flaggedRows(null);
    const html = await renderAlerts();
    expect(html).toContain("What you can do");
    expect(html).toContain("Log today&#x27;s mood and any medications");
    expect(html).toContain(
      "If this keeps going, or you feel different, talk with your care team"
    );
    expect(html).not.toContain("physical activity");
  });

  it("softens the activity suggestion for a lower-activation flag", async () => {
    flaggedRows("hypo");
    const html = await renderAlerts();
    expect(html).toContain(
      "If you feel up to it, consider light physical activity today"
    );
    expect(html).not.toContain("Consider light physical activity today");
  });

  it("keeps a higher-activation flag's suggestions", async () => {
    flaggedRows("hyper");
    const html = await renderAlerts();
    expect(html).toContain("Track your mood and energy levels today");
    expect(html).toContain("Maintain your regular bedtime tonight");
    expect(html).not.toContain("physical activity");
  });

  it("says how many of the last nights a flag rests on when it was not an unbroken run", async () => {
    state.rows.episode_assessments = [
      assessment("2026-10-01", {
        tier: "watch",
        direction: "hypo",
        confidence: 3,
        bestWindowDays: 14,
        consecutiveConcerningDays: 0,
        researchContext: JSON.stringify({
          ...JSON.parse(STORED_CONTEXT),
          persistence: { nights: 9, span: 14 },
        }),
      }),
    ];
    const html = await renderAlerts();
    expect(html).toContain(
      "Lower-activation pattern flag on 9 of the last 14 nights, from the available data"
    );
    expect(html).toContain("Nights outside your usual");
    expect(html).not.toContain("0-day");
  });

  it("still words a flag stored without a night count by its consecutive days", async () => {
    flaggedRows("hyper");
    const html = await renderAlerts();
    expect(html).toContain("2-day higher-activation pattern flag from the available data");
  });

  describe("date range", () => {
    const recentFlag = assessment("2026-09-20", {
      tier: "watch",
      direction: "hyper",
      confidence: 3,
      consecutiveConcerningDays: 2,
      researchContext: STORED_CONTEXT,
    });
    const olderFlag = assessment("2026-05-01", {
      tier: "warning",
      direction: "hypo",
      confidence: 4,
      consecutiveConcerningDays: 3,
      researchContext: STORED_CONTEXT,
    });
    const checked = [assessment("2026-10-01"), assessment("2026-09-30")];

    it("shows the last 90 days unless told otherwise, and says so", async () => {
      state.rows.episode_assessments = [...checked, recentFlag, olderFlag];
      const html = await renderAlerts();
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain("Showing Jul 5 – Oct 2, 2026 · 90 days · 1 flagged night");
      expect(html).toContain("Sep 19 → Sep 20");
      expect(html).not.toContain("Apr 30 → May 1");
    });

    it("keeps the page's totals about everything on record", async () => {
      state.rows.episode_assessments = [...checked, recentFlag, olderFlag];
      const html = await renderAlerts();
      expect(html).toContain("4 current days analyzed, 2 in-app pattern flags");
    });

    it("reaches back to older flags when the range does", async () => {
      state.rows.episode_assessments = [...checked, recentFlag, olderFlag];
      const html = await renderAlerts({ range: "1y" });
      expect(html).toContain("Sep 19 → Sep 20");
      expect(html).toContain("Apr 30 → May 1");
      expect(html).toContain("2 flagged nights");
    });

    it("shows only the dates asked for", async () => {
      state.rows.episode_assessments = [...checked, recentFlag, olderFlag];
      const html = await renderAlerts({ from: "2026-04-25", to: "2026-05-05" });
      expect(html).toContain("Apr 30 → May 1");
      expect(html).not.toContain("Sep 19 → Sep 20");
      expect(html).toContain("Showing Apr 25 – May 5, 2026 · 11 days · 1 flagged night");
      expect(html).toContain('value="2026-04-25"');
    });

    it("says when no pattern checks fall in the range, rather than showing a quiet chart", async () => {
      state.rows.episode_assessments = [olderFlag];
      const html = await renderAlerts();
      expect(html).toContain("No pattern checks in this range");
    });

    it("does not give a past range today's all-clear", async () => {
      state.rows.episode_assessments = [...checked, assessment("2026-09-10")];
      const past = await renderAlerts({ from: "2026-09-01", to: "2026-09-15" });
      expect(past).toContain("No pattern flags in this range");
      expect(past).not.toContain("Checked through the night");

      const current = await renderAlerts({ range: "30d" });
      expect(current).toContain("Checked through the night of Sep 30 → Oct 1.");
    });
  });
});
