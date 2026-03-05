export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const tokens = await db.select().from(oauthTokens).limit(1);
  const isConnected = tokens.length > 0;

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center space-y-6">
        <h1 className="text-3xl font-bold">Welcome</h1>
        <p className="text-muted-foreground">
          Connect your Oura Ring account to start tracking sleep patterns.
        </p>
        <Button asChild>
          <Link href="/dashboard/settings">Connect Oura Ring</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Last Night&apos;s Sleep</CardDescription>
            <CardTitle>--</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Connect Oura and sync data to see results.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Sleep Score</CardDescription>
            <CardTitle>--</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Oura&apos;s daily sleep score.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pattern Status</CardDescription>
            <CardTitle>--</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Anomaly detection results.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
