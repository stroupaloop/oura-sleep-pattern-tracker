import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";
import { refreshAccessToken } from "./oauth";
import type { OuraApiResponse } from "./types";

const BASE_URL = "https://api.ouraring.com";

async function getAccessToken(): Promise<string> {
  const tokens = await db.select().from(oauthTokens).limit(1);
  if (tokens.length === 0) throw new Error("No Oura tokens found");

  const token = tokens[0];
  const now = Math.floor(Date.now() / 1000);

  if (token.expiresAt > now + 300) {
    return token.accessToken;
  }

  const refreshed = await refreshAccessToken(token.refreshToken);
  await db.delete(oauthTokens);
  await db.insert(oauthTokens).values({
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: now + refreshed.expires_in,
    scope: token.scope,
    updatedAt: now,
  });

  return refreshed.access_token;
}

export async function ouraFetchSingle<T>(endpoint: string): Promise<T> {
  const accessToken = await getAccessToken();
  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Oura API ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

export async function ouraFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const accessToken = await getAccessToken();
  const allData: T[] = [];
  let nextToken: string | null = null;

  do {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (nextToken) url.searchParams.set("next_token", nextToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Oura API ${res.status}: ${text}`);
    }

    const body = (await res.json()) as OuraApiResponse<T>;
    allData.push(...body.data);
    nextToken = body.next_token;
  } while (nextToken);

  return allData;
}
