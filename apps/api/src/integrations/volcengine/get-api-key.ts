import { VOLCANO_ARK_API_KEY_DURATION_SECONDS } from "@dafthunk/types";

import { callVolcengineArkApi, type VolcengineCredentials } from "./client";
import {
  VOLCANO_ARK_API_KEY_RESOURCE_TYPE,
  VOLCANO_DEFAULT_PROJECT_NAME,
} from "./constants";
import {
  extractVolcanoListItems,
  listVolcanoEndpointIds,
} from "./list-endpoints";

export interface GetApiKeyResult {
  readonly apiKey: string;
  readonly expiresAt: string;
}

const API_KEY_ID_KEYS = [
  "Id",
  "id",
  "ApiKeyId",
  "apiKeyId",
  "KeyId",
  "keyId",
] as const;

const LIST_API_KEYS_PAGE_SIZE = 10;

function normalizeExpiresAt(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }

  return new Date(
    Date.now() + VOLCANO_ARK_API_KEY_DURATION_SECONDS * 1000
  ).toISOString();
}

export function readApiKeyId(item: unknown): string | null {
  const rawId = readApiKeyIdValue(item);
  if (rawId === null) {
    return null;
  }
  return String(rawId);
}

/** Id as returned by ListApiKeys — numeric for GetRawApiKey, string otherwise. */
export function readApiKeyIdValue(item: unknown): string | number | null {
  if (typeof item === "string" && item.length > 0) {
    return item;
  }
  if (typeof item === "number" && Number.isFinite(item)) {
    return item;
  }
  if (!item || typeof item !== "object") {
    return null;
  }

  const record = item as Record<string, unknown>;
  for (const key of API_KEY_ID_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

async function listVolcanoApiKeyRecords(
  credentials: VolcengineCredentials
): Promise<unknown[]> {
  const collected: unknown[] = [];
  let pageNumber = 1;
  let totalCount = Number.POSITIVE_INFINITY;

  while (collected.length < totalCount) {
    const result = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action: "ListApiKeys",
      queryParams: {
        PageNumber: String(pageNumber),
        PageSize: String(LIST_API_KEYS_PAGE_SIZE),
      },
      body: {
        ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
        Filter: { AllowAll: true },
      },
    });

    const items = extractVolcanoListItems(result);
    if (items.length === 0) {
      break;
    }

    collected.push(...items);

    const total = result.TotalCount ?? result.totalCount;
    if (typeof total === "number" && Number.isFinite(total)) {
      totalCount = total;
    } else if (items.length < LIST_API_KEYS_PAGE_SIZE) {
      break;
    }

    pageNumber += 1;
    if (pageNumber > 100) {
      break;
    }
  }

  return collected;
}

async function getRawVolcanoApiKeyFallback(
  credentials: VolcengineCredentials
): Promise<GetApiKeyResult> {
  const items = await listVolcanoApiKeyRecords(credentials);
  if (items.length === 0) {
    throw new Error(
      "No Volcano Ark endpoints or API keys found. Create an inference endpoint or API key in the Ark console first."
    );
  }

  const apiKeyId = items
    .map(readApiKeyIdValue)
    .find((id): id is string | number => id !== null);

  if (apiKeyId === undefined) {
    throw new Error(
      "ListApiKeys returned entries without ids. Check Ark API key permissions for this access key."
    );
  }

  const rawResult = await callVolcengineArkApi<Record<string, unknown>>({
    credentials,
    action: "GetRawApiKey",
    body: { Id: apiKeyId },
  });

  const apiKey =
    (typeof rawResult.ApiKey === "string" && rawResult.ApiKey) ||
    (typeof rawResult.apiKey === "string" && rawResult.apiKey) ||
    "";

  if (!apiKey) {
    throw new Error("GetRawApiKey returned empty API key.");
  }

  return {
    apiKey,
    expiresAt: normalizeExpiresAt(
      rawResult.ExpiredTime ??
        rawResult.expiredTime ??
        rawResult.ExpiresAt ??
        rawResult.expiresAt
    ),
  };
}

async function getTemporaryVolcanoApiKey(
  credentials: VolcengineCredentials,
  resourceIds: readonly string[]
): Promise<GetApiKeyResult> {
  const result = await callVolcengineArkApi<Record<string, unknown>>({
    credentials,
    action: "GetApiKey",
    body: {
      DurationSeconds: VOLCANO_ARK_API_KEY_DURATION_SECONDS,
      ResourceType: VOLCANO_ARK_API_KEY_RESOURCE_TYPE,
      ResourceIds: [...resourceIds],
      ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    },
  });

  const apiKey =
    (typeof result.ApiKey === "string" && result.ApiKey) ||
    (typeof result.apiKey === "string" && result.apiKey) ||
    "";

  if (!apiKey) {
    throw new Error("GetApiKey returned empty API key");
  }

  return {
    apiKey,
    expiresAt: normalizeExpiresAt(
      result.ExpiredTime ??
        result.expiredTime ??
        result.ExpiresAt ??
        result.expiresAt
    ),
  };
}

export async function getVolcanoArkApiKey(
  credentials: VolcengineCredentials,
  options?: { resourceIds?: readonly string[] }
): Promise<GetApiKeyResult> {
  const resourceIds =
    options?.resourceIds && options.resourceIds.length > 0
      ? options.resourceIds
      : await listVolcanoEndpointIds(credentials);

  if (resourceIds.length > 0) {
    return getTemporaryVolcanoApiKey(credentials, resourceIds);
  }

  return getRawVolcanoApiKeyFallback(credentials);
}
