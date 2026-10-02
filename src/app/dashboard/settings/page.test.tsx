import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG, SENSITIVITY_PRESETS } from "@/lib/analysis/config";
import { OURA_SCOPE } from "@/lib/oura/contracts";
import SettingsPage from "./page";

const state = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>,
  needsReconnect: false,
}));

vi.mock("@/lib/db", async () => {
  const { getTableName } = await import("drizzle-orm");
  type Table = Parameters<typeof getTableName>[0];
  function from(table: Table) {
    const rows = () => Promise.resolve(state.rows[getTableName(table)] ?? []);
    const query = {
      where: () => query,
      orderBy: () => query,
      limit: rows,
    };
    return query;
  }
  return { db: { select: () => ({ from }) } };
});

vi.mock("@/lib/auth", () => ({
  auth: async () => ({ user: { id: "owner", email: "owner@example.com" } }),
  isSensitiveUser: () => true,
  isPrimarySensitiveUser: () => true,
}));

vi.mock("@/lib/oura/connection-health-data", () => ({
  loadOuraConnectionHealth: async () => ({
    needsReconnect: state.needsReconnect,
  }),
}));

function savedConfig(thresholds: Partial<typeof DEFAULT_CONFIG>) {
  return {
    ...DEFAULT_CONFIG,
    ...thresholds,
    version: 7,
    metricWeights: JSON.stringify(DEFAULT_CONFIG.metricWeights),
  };
}

async function renderSettings(): Promise<string> {
  return renderToStaticMarkup(await SettingsPage());
}

function checkedSensitivity(html: string): string | undefined {
  const group = html.match(/aria-label="Sensitivity preset"[\s\S]*?<\/div>/)?.[0];
  return group?.match(/aria-checked="true"[^>]*>([^<]+)</)?.[1];
}

describe("Settings", () => {
  beforeEach(() => {
    state.needsReconnect = false;
    state.rows = {
      oauth_tokens: [
        {
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          scope: OURA_SCOPE,
        },
      ],
      sync_log: [],
      user: [{ bipolarType: "unspecified" }],
      detection_config: [],
    };
  });

  it("shows the sensitivity that is saved", async () => {
    state.rows.detection_config = [savedConfig(SENSITIVITY_PRESETS.high)];
    expect(checkedSensitivity(await renderSettings())).toBe("High");

    state.rows.detection_config = [savedConfig(SENSITIVITY_PRESETS.low)];
    expect(checkedSensitivity(await renderSettings())).toBe("Low");
  });

  it("shows Medium when nothing has been saved, since the defaults are Medium", async () => {
    expect(checkedSensitivity(await renderSettings())).toBe("Medium");
  });

  it("shows Custom when the saved thresholds match no preset", async () => {
    state.rows.detection_config = [
      savedConfig({ ...SENSITIVITY_PRESETS.medium, dailyAnomalyThreshold: 1.7 }),
    ];
    expect(checkedSensitivity(await renderSettings())).toBe("Custom");
  });

  it("shows a lost connection in the banner's amber, in words", async () => {
    state.needsReconnect = true;
    const html = await renderSettings();
    expect(html).toMatch(/text-attention[^"]*">Reconnect required</);
    expect(html).not.toMatch(/\b(red|amber|green)-\d/);
  });
});
