export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { oauthTokens, syncLog, users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { OuraConnectButton } from "./oura-connect-button";
import { DisconnectButton } from "./disconnect-button";
import { BackfillButton, ManualSyncButton } from "./sync-buttons";
import { AnalyzeAllButton } from "./analyze-button";
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

export default async function SettingsPage() {
  const session = await auth();
  const tokens = await db.select().from(oauthTokens).limit(1);
  const isConnected = tokens.length > 0;
  const tokenExpiry = isConnected
    ? new Date(tokens[0].expiresAt * 1000)
    : null;
  const isExpired = tokenExpiry ? tokenExpiry < new Date() : false;

  const recentSyncs = await db
    .select()
    .from(syncLog)
    .orderBy(desc(syncLog.createdAt))
    .limit(5);

  let bipolarType = "unspecified";
  if (session?.user?.id) {
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
          <CardTitle>Condition Profile</CardTitle>
          <CardDescription>
            Help tune detection to your needs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BipolarTypeSelector initial={bipolarType} />
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
                    isExpired
                      ? "text-red-500 font-medium"
                      : "text-green-500 font-medium"
                  }
                >
                  {isExpired ? "Token expired" : "Connected"}
                </span>
              </p>
              {tokenExpiry && (
                <p className="text-sm text-muted-foreground">
                  Token expires: {tokenExpiry.toLocaleString()}
                </p>
              )}
              {isExpired && <OuraConnectButton label="Reconnect Oura" />}
              <DisconnectButton />
            </div>
          ) : (
            <OuraConnectButton label="Connect Oura Ring" />
          )}
        </CardContent>
      </Card>

      {isConnected && !isExpired && (
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
            <AnalyzeAllButton />
          </CardContent>
        </Card>
      )}

      {isConnected && !isExpired && (
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
