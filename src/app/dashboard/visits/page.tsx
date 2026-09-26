export const dynamic = "force-dynamic";

import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { siteVisits } from "@/lib/db/schema";
import { APP_TIME_ZONE } from "@/lib/date-utils";
import {
  describeDevice,
  describeLocation,
  shortVisitorId,
} from "@/lib/notifications/visit-alert";

const LIMIT = 100;

function formatWhen(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(unixSeconds * 1000));
}

export default async function VisitsPage() {
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(siteVisits)
      .orderBy(desc(siteVisits.createdAt))
      .limit(LIMIT),
    db
      .select({
        visits: sql<number>`count(*)`,
        visitors: sql<number>`count(distinct ${siteVisits.visitorId})`,
      })
      .from(siteVisits)
      .then((result) => result[0] ?? { visits: 0, visitors: 0 }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Visits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {Number(totals.visits)} visits from {Number(totals.visitors)} distinct
          visitors. Location is approximate, derived from IP.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No visits recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Who</th>
                <th className="px-3 py-2 font-medium">Where</th>
                <th className="px-3 py-2 font-medium">Device</th>
                <th className="px-3 py-2 font-medium">Page</th>
                <th className="px-3 py-2 font-medium">Alerted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatWhen(row.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    {row.isAuthed && row.email
                      ? row.email
                      : `Anonymous #${shortVisitorId(row.visitorId)}`}
                  </td>
                  <td className="px-3 py-2">
                    {describeLocation({
                      city: row.city,
                      region: row.region,
                      country: row.country,
                    })}
                  </td>
                  <td className="px-3 py-2">{describeDevice(row.userAgent)}</td>
                  <td className="px-3 py-2">{row.path}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.alerted ? "yes" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
