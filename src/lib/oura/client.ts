import { db } from "@/lib/db";
import { oauthTokens } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { refreshAccessToken, resolveOuraScope } from "./oauth";
import {
  OuraRequestError,
  parseOuraCollectionResponse,
} from "./contracts";

const BASE_URL = "https://api.ouraring.com";
const REFRESH_RECOVERY_DELAYS_MS = [0, 100, 250, 500, 1000, 1500];
const PERSIST_RETRY_DELAYS_MS = [0, 100, 250, 500, 1000];

type StoredOuraToken = typeof oauthTokens.$inferSelect;
type RefreshedOuraToken = Awaited<ReturnType<typeof refreshAccessToken>>;

const refreshFlights = new Map<string, Promise<string>>();

async function loadToken(): Promise<StoredOuraToken> {
  const tokens = await db.select().from(oauthTokens).limit(1);
  if (tokens.length === 0) throw new Error("No Oura tokens found");
  return tokens[0];
}

async function waitForRotatedAccessToken(
  snapshot: StoredOuraToken
): Promise<string | null> {
  for (const delay of REFRESH_RECOVERY_DELAYS_MS) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      const latest = await loadToken();
      if (
        latest.accessToken !== snapshot.accessToken ||
        latest.refreshToken !== snapshot.refreshToken
      ) {
        return latest.accessToken;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function persistRefreshedToken(
  snapshot: StoredOuraToken,
  refreshed: RefreshedOuraToken
): Promise<string | null> {
  let lastError: unknown = null;

  for (const delay of PERSIST_RETRY_DELAYS_MS) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      const now = Math.floor(Date.now() / 1000);
      const updated = await db
        .update(oauthTokens)
        .set({
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token,
          expiresAt: now + refreshed.expires_in,
          scope: resolveOuraScope(refreshed.scope, snapshot.scope),
          updatedAt: now,
        })
        .where(
          and(
            eq(oauthTokens.id, snapshot.id),
            eq(oauthTokens.refreshToken, snapshot.refreshToken)
          )
        )
        .returning({ accessToken: oauthTokens.accessToken });

      return updated[0]?.accessToken ?? null;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Oura token persistence failed");
}

async function refreshStoredAccessToken(
  snapshot: StoredOuraToken
): Promise<string> {
  let refreshed: RefreshedOuraToken;
  try {
    refreshed = await refreshAccessToken(snapshot.refreshToken);
  } catch (error) {
    const rotatedAccessToken = await waitForRotatedAccessToken(snapshot);
    if (rotatedAccessToken) {
      return rotatedAccessToken;
    }
    throw error;
  }

  try {
    const persistedAccessToken = await persistRefreshedToken(
      snapshot,
      refreshed
    );
    if (persistedAccessToken) {
      return persistedAccessToken;
    }
  } catch (error) {
    const rotatedAccessToken = await waitForRotatedAccessToken(snapshot);
    if (rotatedAccessToken) {
      return rotatedAccessToken;
    }
    throw error;
  }

  const rotatedAccessToken = await waitForRotatedAccessToken(snapshot);
  if (rotatedAccessToken) {
    return rotatedAccessToken;
  }
  throw new Error("Oura token refresh conflict");
}

async function refreshAccessTokenOnce(
  snapshot: StoredOuraToken
): Promise<string> {
  const generation = snapshot.refreshToken;
  const existing = refreshFlights.get(generation);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    const latest = await loadToken();
    if (
      latest.accessToken !== snapshot.accessToken ||
      latest.refreshToken !== snapshot.refreshToken
    ) {
      return latest.accessToken;
    }
    return refreshStoredAccessToken(latest);
  })();
  refreshFlights.set(generation, promise);
  const clear = () => {
    if (refreshFlights.get(generation) === promise) {
      refreshFlights.delete(generation);
    }
  };
  void promise.then(clear, clear);
  return promise;
}

async function getAccessToken(): Promise<string> {
  const token = await loadToken();
  const now = Math.floor(Date.now() / 1000);

  if (token.expiresAt > now + 300) {
    return token.accessToken;
  }

  return refreshAccessTokenOnce(token);
}

async function recoverAccessToken(rejectedAccessToken: string): Promise<string> {
  const latest = await loadToken();
  if (latest.accessToken !== rejectedAccessToken) {
    return latest.accessToken;
  }
  return refreshAccessTokenOnce(latest);
}

async function fetchWithAccessToken(
  url: string,
  accessToken: string
): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function authorizedFetch(url: string): Promise<Response> {
  let accessToken = await getAccessToken();
  let response = await fetchWithAccessToken(url, accessToken);
  if (response.status !== 401) {
    return response;
  }

  accessToken = await recoverAccessToken(accessToken);
  response = await fetchWithAccessToken(url, accessToken);
  return response;
}

export async function ouraFetchSingle<T>(endpoint: string): Promise<T> {
  const res = await authorizedFetch(`${BASE_URL}/${endpoint}`);
  if (!res.ok) {
    throw new OuraRequestError(res.status, endpoint);
  }
  return (await res.json()) as T;
}

export async function ouraFetch<T>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const allData: T[] = [];
  let nextToken: string | null = null;

  do {
    const url = new URL(`${BASE_URL}/${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    if (nextToken) url.searchParams.set("next_token", nextToken);

    const res = await authorizedFetch(url.toString());

    if (!res.ok) {
      throw new OuraRequestError(res.status, endpoint);
    }

    const body = parseOuraCollectionResponse<T>(await res.json(), endpoint);
    allData.push(...body.data);
    nextToken = body.next_token;
  } while (nextToken);

  return allData;
}
