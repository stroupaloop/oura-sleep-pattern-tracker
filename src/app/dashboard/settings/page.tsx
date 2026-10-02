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
import { OuraConnectButton } from "./oura-connect-button";
import { DisconnectButton } from "./disconnect-button";
import { BackfillButton, ManualSyncButton } from "./sync-buttons";
import { DetectionConfig } from "./detection-config";
import { BipolarTypeSelector } from "./bipolar-type-selector";
import { MedicationSettings } from "./medication-settings";
import { NotificationSettings } from "./notification-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { missingOuraScopes } from "@/lib/oura/oauth";
import type { OuraScope } from "@/lib/oura/contracts";
import { loadOuraConnectionHealth } from "@/lib/oura/connection-health-data";

const SCOPE_LABELS: Record<OuraScope, string> = {
  email: "email address",
  personal: "profile",
  daily: "sleep, readiness, activity and stress",
  heartrate: "heart rate",
  workout: "workouts",
  tag: "tags",
  session: "sessions",
  spo2: "blood oxygen",
  stress: "resilience",
  heart_health: "VO₂ max and cardiovascular age",
};

function formatScopeList(scopes: OuraScope[]): string {
  const labels = scopes.map((scope) => SCOPE_LABELS[scope]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
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

  const recentSyncs = await db
    .select()
    .from(syncLog)
    .orderBy(desc(syncLog.createdAt))
    .limit(5);

  let bipolarType = "unspecified";
  if (canManageProfile && session?.user?.id) {
    const userRows = await db
      .select({ bipolarType: users.bipolarType })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);
    bipolarType = userRows[0]?.bipolarType ?? "unspecified";
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Pattern Profile</CardTitle>
          <CardDescription>
            Choose how this app weights exploratory wearable patterns. This
            does not diagnose Bipolar I or Bipolar II.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManageProfile ? (
            <BipolarTypeSelector initial={bipolarType} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Only the primary private-data owner can change the profile used
              by detection.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Medication Management</CardTitle>
          <CardDescription>
            Manage your medications, dosages, and tracking periods.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MedicationSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Daily log reminders by email or SMS, sent only if the day&apos;s
            log is still empty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettings />
        </CardContent>
      </Card>

      <Card id="oura" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>Oura Ring Connection</CardTitle>
          <CardDescription>
            Connect your Oura Ring account to sync sleep data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <div className="space-y-2">
              <p className="text-sm">
                Status:{" "}
                <span
                  className={
                    needsReconnect
                      ? "text-red-400 font-medium"
                      : isExpired || isMissingData
                        ? "text-amber-500 font-medium"
                        : "text-green-500 font-medium"
                  }
                >
                  {needsReconnect
                    ? "Reconnect required"
                    : isMissingData
                      ? "Connected · some data not shared"
                      : isExpired
                        ? "Connected · refresh due"
                        : "Connected"}
                </span>
              </p>
              {tokenExpiry && (
                <p className="text-sm text-muted-foreground">
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
                  Oura isn&apos;t sharing {formatScopeList(missingScopes)}. If
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
        </CardContent>
      </Card>

      {isConnected && canManageOura && (
        <Card>
          <CardHeader>
            <CardTitle>Data Sync</CardTitle>
            <CardDescription>
              Pull sleep data from your Oura Ring.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <BackfillButton />
            <ManualSyncButton />
          </CardContent>
        </Card>
      )}

      {isConnected && canManageOura && (
        <Card>
          <CardHeader>
            <CardTitle>Anomaly Detection</CardTitle>
            <CardDescription>
              Configure sensitivity for multi-day pattern detection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DetectionConfig />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>Recent data synchronization activity.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSyncs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No syncs yet. Connect your Oura Ring to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {recentSyncs.map((sync) => (
                <div
                  key={sync.id}
                  className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm border-b pb-2"
                >
                  <span>
                    {sync.syncType} ({sync.startDate} to {sync.endDate})
                  </span>
                  <span
                    className={
                      sync.status === "success"
                        ? "text-green-500"
                        : sync.status === "partial"
                          ? "text-amber-500"
                          : "text-red-500"
                    }
                  >
                    {sync.status} - {sync.recordsFetched ?? 0} records
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
