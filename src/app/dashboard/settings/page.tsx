export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { oauthTokens, syncLog, users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import {
  auth,
  isPrimarySensitiveUser,
  isSensitiveUser,
} from "@/lib/auth";
import { eq } from "drizzle-orm";
import {
  loadActiveConfig,
  SENSITIVITY_PRESETS,
  type DetectionConfigValues,
} from "@/lib/analysis/config";
import type { Tone } from "@/lib/design/tone";
import { OuraConnectButton } from "./oura-connect-button";
import { DisconnectButton } from "./disconnect-button";
import { BackfillButton, ManualSyncButton } from "./sync-buttons";
import { DetectionConfig, type SensitivityPreset } from "./detection-config";
import { BipolarTypeSelector } from "./bipolar-type-selector";
import { MedicationSettings } from "./medication-settings";
import { NotificationSettings } from "./notification-settings";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { missingOuraScopes } from "@/lib/oura/oauth";
import { formatOuraScopeList } from "@/lib/oura/scope-labels";
import { loadOuraConnectionHealth } from "@/lib/oura/connection-health-data";
import { PageHeader } from "@/components/page-header";

function savedPresetOf(config: DetectionConfigValues): SensitivityPreset | null {
  const presets = Object.keys(SENSITIVITY_PRESETS) as SensitivityPreset[];
  return (
    presets.find((preset) =>
      Object.entries(SENSITIVITY_PRESETS[preset]).every(
        ([key, value]) =>
          Math.abs(
            config[key as keyof (typeof SENSITIVITY_PRESETS)[typeof preset]] -
              value
          ) < 1e-9
      )
    ) ?? null
  );
}

export default async function SettingsPage() {
  const session = await auth();
  const tokens = await db.select().from(oauthTokens).limit(1);
  const isConnected = tokens.length > 0;
  const tokenExpiry = isConnected
    ? new Date(tokens[0].expiresAt * 1000)
    : null;
  const isExpired = tokenExpiry ? tokenExpiry < new Date() : false;
  const canManageOura = isSensitiveUser(session?.user?.email);
  const canManageProfile = isPrimarySensitiveUser(session?.user?.email);
  const missingScopes = isConnected ? missingOuraScopes(tokens[0].scope) : [];
  const connectionHealth = isConnected
    ? await loadOuraConnectionHealth().catch(() => null)
    : null;
  const needsReconnect = connectionHealth?.needsReconnect ?? false;
  const isMissingData = missingScopes.length > 0;
  const showDetection = isConnected && canManageOura;

  const [recentSyncs, activeConfig] = await Promise.all([
    db.select().from(syncLog).orderBy(desc(syncLog.createdAt)).limit(5),
    showDetection ? loadActiveConfig() : null,
  ]);

  let bipolarType = "unspecified";
  if (canManageProfile && session?.user?.id) {
    const userRows = await db
      .select({ bipolarType: users.bipolarType })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    bipolarType = userRows[0]?.bipolarType ?? "unspecified";
  }

  const connectionStatus: { label: string; tone: Tone } = needsReconnect
    ? { label: "Reconnect required", tone: "attention" }
    : isMissingData
      ? { label: "Connected · some data not shared", tone: "attention" }
      : isExpired
        ? { label: "Connected · refresh due", tone: "neutral" }
        : { label: "Connected", tone: "calm" };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Settings" />

      <Panel
        id="pattern-profile"
        title="Pattern Profile"
        description="Choose how this app weights exploratory wearable patterns. This does not diagnose Bipolar I or Bipolar II."
      >
        {canManageProfile ? (
          <BipolarTypeSelector initial={bipolarType} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Only the primary private-data owner can change the profile used
            by detection.
          </p>
        )}
      </Panel>

      <Panel
        id="medications"
        title="Medication Management"
        description="Manage your medications, dosages, and tracking periods."
      >
        <MedicationSettings />
      </Panel>

      <Panel
        id="notifications"
        title="Notification Preferences"
        description="Daily log reminders by email or SMS, sent only if the day's log is still empty."
      >
        <NotificationSettings />
      </Panel>

      <div id="oura" className="scroll-mt-6">
        <Panel
          id="oura-connection"
          title="Oura Ring Connection"
          description="Connect your Oura Ring account to sync sleep data."
        >
          {isConnected ? (
            <div className="space-y-2">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                Status:
                <Pill tone={connectionStatus.tone}>{connectionStatus.label}</Pill>
              </p>
              {tokenExpiry && (
                <p className="text-sm text-muted-foreground tabular-nums">
                  Current access token expiry: {tokenExpiry.toLocaleString("en-US", { timeZone: "America/New_York" })}
                </p>
              )}
              {isExpired && !needsReconnect && (
                <p className="text-xs text-muted-foreground">
                  The access token refreshes automatically on the next sync.
                </p>
              )}
              {needsReconnect && (
                <p className="text-sm text-muted-foreground">
                  Oura rejected this connection, so syncing has stopped.
                  Reconnect to resume it.
                </p>
              )}
              {isMissingData && (
                <p className="text-sm text-muted-foreground">
                  Oura isn&apos;t sharing {formatOuraScopeList(missingScopes)}. If
                  those boxes weren&apos;t offered when you connected, allow
                  them for this app at cloud.ouraring.com under OAuth
                  applications first. Then reconnect and leave every box
                  ticked.
                </p>
              )}
              {canManageOura && (needsReconnect || isMissingData) && (
                <OuraConnectButton label="Reconnect Oura" />
              )}
              {canManageOura ? (
                <DisconnectButton />
              ) : (
                <p className="text-xs text-muted-foreground">
                  The private-data owner manages this connection.
                </p>
              )}
            </div>
          ) : canManageOura ? (
            <OuraConnectButton label="Connect Oura Ring" />
          ) : (
            <p className="text-sm text-muted-foreground">
              The private-data owner manages this connection.
            </p>
          )}
        </Panel>
      </div>

      {showDetection && (
        <Panel
          id="data-sync"
          title="Data Sync"
          description="Sync pulls the last 7 days from Oura. Backfill pulls the last 90 days, recomputes the pattern checks for every night on record, and lists what arrived for each kind of data."
        >
          <div className="space-y-4">
            <BackfillButton />
            <ManualSyncButton />
          </div>
        </Panel>
      )}

      {showDetection && (
        <Panel
          id="anomaly-detection"
          title="Anomaly Detection"
          description="Configure sensitivity for multi-day pattern detection."
        >
          <DetectionConfig
            savedPreset={activeConfig ? savedPresetOf(activeConfig) : null}
          />
        </Panel>
      )}

      <Panel
        id="sync-history"
        title="Sync History"
        description="Recent data synchronization activity."
      >
        {recentSyncs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No syncs yet. Connect your Oura Ring to get started.
          </p>
        ) : (
          <ul className="divide-y text-sm tabular-nums">
            {recentSyncs.map((sync) => (
              <li
                key={sync.id}
                className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0 sm:flex-row sm:justify-between"
              >
                <span>
                  {sync.syncType} ({sync.startDate} to {sync.endDate})
                </span>
                <span
                  className={
                    sync.status === "success"
                      ? "text-muted-foreground"
                      : "text-attention"
                  }
                >
                  {sync.status} - {sync.recordsFetched ?? 0} records
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
