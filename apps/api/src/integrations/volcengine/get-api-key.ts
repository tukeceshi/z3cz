import {
  collectVolcanoArkEndpointIds,
  VOLCANO_ARK_API_KEY_DURATION_SECONDS,
  type VolcanoInterfaceMetadata,
} from "@dafthunk/types";

import { callVolcengineArkApi, type VolcengineCredentials } from "./client";
import {
  VOLCANO_ARK_API_KEY_RESOURCE_TYPE,
  VOLCANO_DEFAULT_PROJECT_NAME,
} from "./constants";
import { VolcanoArkNotOpenedError } from "./errors";
import { ensureVolcanoModelEndpoints } from "./ensure-volcano-endpoints";
import {
  extractVolcanoListItems,
  listVolcanoEndpointIds,
} from "./list-endpoints";

export interface GetApiKeyResult {
  readonly apiKey: string;
  readonly expiresAt: string;
  readonly scope: "endpoint" | "model";
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

async function resolveVolcanoEndpointIds(params: {
  readonly credentials: VolcengineCredentials;
  readonly metadata?: VolcanoInterfaceMetadata;
}): Promise<readonly string[]> {
  const fromMetadata = params.metadata
    ? collectVolcanoArkEndpointIds(params.metadata)
    : [];
  if (fromMetadata.length > 0) {
    return fromMetadata;
  }

  const listed = await listVolcanoEndpointIds(params.credentials);
  if (listed.length > 0) {
    return listed;
  }

  if (!params.metadata) {
    return [];
  }

  const ensured = await ensureVolcanoModelEndpoints({
    credentials: params.credentials,
    metadata: params.metadata,
  });
  return ensured.endpointIds;
}

function readInlineApiKeyFromListItem(item: unknown): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const record = item as Record<string, unknown>;
  for (const key of ["ApiKey", "apiKey"]) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

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
  return listVolcanoApiKeyPageRecords(credentials, {
    ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
    Filter: { AllowAll: true },
  });
}

async function listVolcanoApiKeyPageRecords(
  credentials: VolcengineCredentials,
  body: Record<string, unknown>
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
      body,
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

function buildGetRawApiKeyBodies(item: unknown): Record<string, unknown>[] {
  if (!item || typeof item !== "object") {
    return [];
  }

  const record = item as Record<string, unknown>;
  const bodies: Record<string, unknown>[] = [];
  const id = readApiKeyIdValue(item);

  if (id !== null) {
    bodies.push({ Id: id });
    if (typeof id === "number") {
      bodies.push({ Id: String(id) });
    }
  }

  const sid = record.SID ?? record.sid;
  if (typeof sid === "string" && sid.length > 0) {
    bodies.push({ SID: sid });
  }

  const key = record.Key ?? record.key;
  if (typeof key === "string" && key.length > 0) {
    bodies.push({ Key: key });
  }

  return bodies;
}

async function getRawVolcanoApiKeyFallback(
  credentials: VolcengineCredentials
): Promise<GetApiKeyResult> {
  const items = await listVolcanoApiKeyRecords(credentials);
  if (items.length === 0) {
    throw new VolcanoArkNotOpenedError();
  }

  for (const item of items) {
    const inlineApiKey = readInlineApiKeyFromListItem(item);
    if (inlineApiKey) {
      return {
        apiKey: inlineApiKey,
        expiresAt: normalizeExpiresAt(
          typeof item === "object" && item !== null
            ? (item as Record<string, unknown>).ExpiredTime ??
                (item as Record<string, unknown>).expiredTime ??
                (item as Record<string, unknown>).ExpiresAt ??
                (item as Record<string, unknown>).expiresAt
            : undefined
        ),
        scope: "model",
      };
    }
  }

  const apiKeyId = items
    .map(readApiKeyIdValue)
    .find((id): id is string | number => id !== null);

  if (apiKeyId === undefined) {
    throw new Error(
      "ListApiKeys returned entries without ids. Check Ark API key permissions for this access key."
    );
  }

  const lookupItem = items.find((item) => readApiKeyIdValue(item) === apiKeyId);
  const lookupBodies = lookupItem
    ? buildGetRawApiKeyBodies(lookupItem)
    : [{ Id: apiKeyId }];

  for (const body of lookupBodies) {
    try {
      const rawResult = await callVolcengineArkApi<Record<string, unknown>>({
        credentials,
        action: "GetRawApiKey",
        body,
      });

      const apiKey =
        (typeof rawResult.ApiKey === "string" && rawResult.ApiKey) ||
        (typeof rawResult.apiKey === "string" && rawResult.apiKey) ||
        "";

      if (!apiKey) {
        continue;
      }

      return {
        apiKey,
        expiresAt: normalizeExpiresAt(
          rawResult.ExpiredTime ??
            rawResult.expiredTime ??
            rawResult.ExpiresAt ??
            rawResult.expiresAt
        ),
        scope: "model",
      };
    } catch {
      continue;
    }
  }

  throw new Error("GetRawApiKey returned empty API key.");
}

async function getTemporaryVolcanoApiKey(
  credentials: VolcengineCredentials,
  resourceIds: readonly string[],
  resourceType: string = VOLCANO_ARK_API_KEY_RESOURCE_TYPE
): Promise<GetApiKeyResult> {
  const result = await callVolcengineArkApi<Record<string, unknown>>({
    credentials,
    action: "GetApiKey",
    body: {
      DurationSeconds: VOLCANO_ARK_API_KEY_DURATION_SECONDS,
      ResourceType: resourceType,
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
    scope: "endpoint",
  };
}

/** Issue one interface-level Ark API key (endpoint-scoped or console raw). */
export async function getVolcanoArkApiKey(
  credentials: VolcengineCredentials,
  options?: {
    readonly resourceIds?: readonly string[];
    readonly metadata?: VolcanoInterfaceMetadata;
  }
): Promise<GetApiKeyResult> {
  const resourceIds =
    options?.resourceIds && options.resourceIds.length > 0
      ? options.resourceIds
      : await resolveVolcanoEndpointIds({
          credentials,
          metadata: options?.metadata,
        });

  if (resourceIds.length > 0) {
    return getTemporaryVolcanoApiKey(credentials, resourceIds);
  }

  try {
    return await getRawVolcanoApiKeyFallback(credentials);
  } catch (error) {
    if (!(error instanceof VolcanoArkNotOpenedError)) {
      throw error;
    }
  }

  throw new VolcanoArkNotOpenedError();
}
