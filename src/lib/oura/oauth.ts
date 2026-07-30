import { OURA_SCOPE, OuraRequestError } from "./contracts";

export { OURA_SCOPE, OURA_SCOPES, resolveOuraScope } from "./contracts";

const AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
const TOKEN_URL = "https://api.ouraring.com/oauth/token";

interface OuraTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export function getOuraAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.OURA_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/oura/callback`,
    scope: OURA_SCOPE,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/oura/callback`,
    }),
  });

  if (!response.ok) {
    throw new OuraRequestError(response.status, "token_exchange");
  }

  return response.json() as Promise<OuraTokenResponse>;
}

export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.OURA_CLIENT_ID!,
      client_secret: process.env.OURA_CLIENT_SECRET!,
    }),
  });

  if (!response.ok) {
    throw new OuraRequestError(response.status, "token_refresh");
  }

  return response.json() as Promise<OuraTokenResponse>;
}
