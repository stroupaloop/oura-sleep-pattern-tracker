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
// import { NotificationSettings } from "./notification-settings";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OURA_SCOPES } from "@/lib/oura/oauth";

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
  const grantedScopes = new Set(
    (tokens[0]?.scope ?? "").split(/\s+/).filter(Boolean)
  );
  const missingScopes = OURA_SCOPES.filter(
    (scope) => !grantedScopes.has(scope)
  );
  const needsReauthorization = isConnected && missingScopes.length > 0;

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

      {/* Notification Preferences hidden — cron not configured on Vercel free tier
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Configure nightly check-in reminders via email or SMS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationSettings />
        </CardContent>
      </Card>
      */}

      <Card>
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
                    isExpired || needsReauthorization
                      ? "text-amber-500 font-medium"
                      : "text-green-500 font-medium"
                  }
                >
                  {needsReauthorization
                    ? "Reconnect required"
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
              {isExpired && !needsReauthorization && (
                <p className="text-xs text-muted-foreground">
                  The access token refreshes automatically on the next sync.
                </p>
              )}
              {needsReauthorization && (
                <p className="text-xs text-muted-foreground">
                  Reconnect once to grant access to the newly supported Oura
                  datasets.
                </p>
              )}
              {canManageOura && needsReauthorization && (
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
