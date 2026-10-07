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
  useRouter: () => ({ refresh: vi.fn() }),
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

async function renderAlerts(): Promise<string> {
  return renderToStaticMarkup(await AlertsPage());
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
});
