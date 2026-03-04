import { db } from "@/lib/db";
import { oauthTokens, syncLog } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { OuraConnectButton } from "./oura-connect-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage() {
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

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
            </div>
          ) : (
            <OuraConnectButton label="Connect Oura Ring" />
          )}
        </CardContent>
      </Card>

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
                  className="flex justify-between text-sm border-b pb-2"
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
