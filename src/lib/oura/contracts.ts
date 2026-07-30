import type {
  OuraApiResponse,
  OuraEnhancedTag,
  OuraSleepPeriod,
  OuraTimeSeries,
} from "./types";

export const OURA_SCOPES = [
  "email",
  "personal",
  "daily",
  "heartrate",
  "workout",
  "tag",
  "session",
  "spo2Daily",
] as const;

export const OURA_SCOPE = OURA_SCOPES.join(" ");

export function resolveOuraScope(
  grantedScope: string | null | undefined,
  tokenScope?: string
): string {
  return grantedScope?.trim() || tokenScope?.trim() || OURA_SCOPE;
}

export const OURA_ENDPOINTS = {
  vo2Max: "v2/usercollection/vO2_max",
  sleepTime: "v2/usercollection/sleep_time",
} as const;

export type OuraSyncWarningCode =
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

  constructor(status: number, operation: string) {
    super(`Oura request failed for ${operation} with HTTP ${status}`);
    this.name = "OuraRequestError";
    this.status = status;
    this.operation = operation;
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
