import type {
  OuraApiResponse,
  OuraEnhancedTag,
  OuraSleepPeriod,
  OuraTimeSeries,
} from "./types";

/**
 * Scope names as Oura's live API grants them. Its OpenAPI document calls the
 * SpO2 scope `spo2Daily` and leaves out `stress` and `heart_health`; Oura
 * silently drops names it does not recognise, so requesting those spellings
 * leaves the matching datasets answering 401.
 */
export const OURA_SCOPES = [
  "email",
  "personal",
  "daily",
  "heartrate",
  "workout",
  "tag",
  "session",
  "spo2",
  "stress",
  "heart_health",
] as const;

export type OuraScope = (typeof OURA_SCOPES)[number];

export const OURA_SCOPE = OURA_SCOPES.join(" ");

/** The scope each synced dataset needs, as the live API enforces it. */
export const OURA_DATASET_SCOPES = {
  sleep: "daily",
  daily_sleep: "daily",
  daily_readiness: "daily",
  daily_activity: "daily",
  daily_stress: "daily",
  sleep_time: "daily",
  rest_mode_period: "daily",
  daily_resilience: "stress",
  daily_spo2: "spo2",
  workout: "workout",
  session: "session",
  heartrate: "heartrate",
  enhanced_tag: "tag",
  daily_cardiovascular_age: "heart_health",
  vO2_max: "heart_health",
  personal_info: "personal",
} as const satisfies Record<string, OuraScope>;

export type OuraDataset = keyof typeof OURA_DATASET_SCOPES;

export function resolveOuraScope(
  grantedScope: string | null | undefined,
  tokenScope?: string
): string {
  return grantedScope?.trim() || tokenScope?.trim() || OURA_SCOPE;
}

/**
 * The bare scope names in a stored grant, or null when none is recorded.
 * Oura reports grants with a prefix (`extapi:daily`) that the authorize
 * request does not use.
 */
export function parseGrantedOuraScopes(
  scope: string | null | undefined
): Set<string> | null {
  const names = (scope ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((entry) => entry.slice(entry.lastIndexOf(":") + 1))
    .filter(Boolean);
  return names.length > 0 ? new Set(names) : null;
}

export function missingOuraScopes(
  scope: string | null | undefined
): OuraScope[] {
  const granted = parseGrantedOuraScopes(scope);
  return OURA_SCOPES.filter((name) => !granted?.has(name));
}

/** An unknown grant counts as granted, so the API stays the judge. */
export function isOuraDatasetGranted(
  granted: Set<string> | null,
  dataset: OuraDataset
): boolean {
  return granted == null || granted.has(OURA_DATASET_SCOPES[dataset]);
}

export const OURA_ENDPOINTS = {
  vo2Max: "v2/usercollection/vO2_max",
  sleepTime: "v2/usercollection/sleep_time",
} as const;

export type OuraSyncWarningCode =
  | "not_granted"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "api_error"
  | "upstream_error"
  | "invalid_response"
  | "unexpected_error";

export interface OuraSyncWarning {
  dataset: string;
  code: OuraSyncWarningCode;
}

export interface OptionalOuraCollection<T> {
  data: T[];
  warning: OuraSyncWarning | null;
}

export interface OptionalOuraTask<T> {
  value: T | null;
  warning: OuraSyncWarning | null;
}

export class OuraRequestError extends Error {
  readonly status: number;
  readonly operation: string;
  readonly reason: string | null;

  /** `reason` is Oura's OAuth error code (`invalid_grant`), never a body. */
  constructor(status: number, operation: string, reason?: string | null) {
    super(
      `Oura request failed for ${operation} with HTTP ${status}${
        reason ? ` (${reason})` : ""
      }`
    );
    this.name = "OuraRequestError";
    this.status = status;
    this.operation = operation;
    this.reason = reason ?? null;
  }
}

/** Reads the OAuth `error` code from a failed token response, if it has one. */
export async function readOAuthErrorCode(
  response: Response
): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    const code =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>).error
        : null;
    return typeof code === "string" && /^[a-z_]{1,64}$/.test(code)
      ? code
      : null;
  } catch {
    return null;
  }
}

export class OuraContractError extends Error {
  readonly endpoint: string;

  constructor(endpoint: string) {
    super(`Invalid Oura response for ${endpoint}`);
    this.name = "OuraContractError";
    this.endpoint = endpoint;
  }
}

export function parseOuraCollectionResponse<T>(
  value: unknown,
  endpoint: string
): OuraApiResponse<T> {
  if (typeof value !== "object" || value === null) {
    throw new OuraContractError(endpoint);
  }

  const response = value as Record<string, unknown>;
  if (!Array.isArray(response.data)) {
    throw new OuraContractError(endpoint);
  }
  if (
    response.next_token !== undefined &&
    response.next_token !== null &&
    typeof response.next_token !== "string"
  ) {
    throw new OuraContractError(endpoint);
  }

  return {
    data: response.data as T[],
    next_token: (response.next_token as string | null | undefined) ?? null,
  };
}

export function toOuraSyncWarning(
  dataset: string,
  error: unknown
): OuraSyncWarning {
  if (error instanceof OuraContractError) {
    return { dataset, code: "invalid_response" };
  }
  if (error instanceof OuraRequestError) {
    if (error.status === 401) return { dataset, code: "unauthorized" };
    if (error.status === 403) return { dataset, code: "forbidden" };
    if (error.status === 429) return { dataset, code: "rate_limited" };
    if (error.status >= 500) return { dataset, code: "upstream_error" };
    return { dataset, code: "api_error" };
  }
  return { dataset, code: "unexpected_error" };
}

export async function fetchOptionalOuraCollection<T>(
  dataset: string,
  fetchCollection: () => Promise<T[]>
): Promise<OptionalOuraCollection<T>> {
  const result = await runOptionalOuraTask(dataset, fetchCollection);
  return {
    data: result.value ?? [],
    warning: result.warning,
  };
}

/**
 * Skips a dataset the stored grant does not cover instead of asking Oura,
 * since the 401 it answers with would otherwise rotate the single-use
 * refresh token for nothing.
 */
export async function fetchGrantedOuraCollection<T>(
  granted: Set<string> | null,
  dataset: OuraDataset,
  fetchCollection: () => Promise<T[]>
): Promise<OptionalOuraCollection<T>> {
  if (!isOuraDatasetGranted(granted, dataset)) {
    return { data: [], warning: { dataset, code: "not_granted" } };
  }
  return fetchOptionalOuraCollection(dataset, fetchCollection);
}

export async function runOptionalOuraTask<T>(
  dataset: string,
  task: () => Promise<T>
): Promise<OptionalOuraTask<T>> {
  try {
    return { value: await task(), warning: null };
  } catch (error) {
    return {
      value: null,
      warning: toOuraSyncWarning(dataset, error),
    };
  }
}

export function formatOuraSyncWarnings(
  warnings: OuraSyncWarning[]
): string | null {
  if (warnings.length === 0) return null;
  return warnings
    .map((warning) => `${warning.dataset}:${warning.code}`)
    .join(",");
}

export function averageOuraTimeSeries(
  series: OuraTimeSeries | null
): number | null {
  const values =
    series?.items.filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    ) ?? [];

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function minimumOuraTimeSeries(
  series: OuraTimeSeries | null
): number | null {
  const values =
    series?.items.filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value)
    ) ?? [];

  return values.length > 0 ? Math.min(...values) : null;
}

export function getEnhancedTagDay(
  tag: Pick<OuraEnhancedTag, "id" | "start_day" | "end_day">
): string {
  const day = tag.start_day ?? tag.end_day;
  if (!day) {
    throw new OuraContractError("enhanced_tag");
  }
  return day;
}

export function getAppAlignedHypnogram(
  sleep: Pick<
    OuraSleepPeriod,
    "app_sleep_phase_5_min" | "sleep_phase_5_min"
  >
): string | null {
  return sleep.app_sleep_phase_5_min ?? sleep.sleep_phase_5_min ?? null;
}
