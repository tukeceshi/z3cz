import { callVolcengineArkApi, type VolcengineCredentials } from "./client";
import { VOLCANO_DEFAULT_PROJECT_NAME } from "./constants";

const ENDPOINT_ID_KEYS = ["Id", "id", "EndpointId", "endpointId"] as const;

export function readEndpointId(item: unknown): string | null {
  if (typeof item === "number" && Number.isFinite(item)) {
    return String(item);
  }
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  for (const key of ENDPOINT_ID_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

export function extractVolcanoListItems(
  result: Record<string, unknown>
): unknown[] {
  for (const key of [
    "Items",
    "items",
    "Endpoints",
    "endpoints",
    "ApiKeys",
    "apiKeys",
  ]) {
    const value = result[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

export async function listVolcanoEndpointIds(
  credentials: VolcengineCredentials
): Promise<string[]> {
  const collected: string[] = [];
  let pageNumber = 1;
  const pageSize = 100;

  while (pageNumber <= 100) {
    const result = await callVolcengineArkApi<Record<string, unknown>>({
      credentials,
      action: "ListEndpoints",
      body: {
        PageNumber: pageNumber,
        PageSize: pageSize,
        ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
      },
    });

    const items = extractVolcanoListItems(result);
    if (items.length === 0) {
      break;
    }

    collected.push(
      ...items
        .map(readEndpointId)
        .filter((id): id is string => id !== null)
    );

    const total = result.TotalCount ?? result.totalCount;
    if (typeof total === "number" && collected.length >= total) {
      break;
    }
    if (items.length < pageSize) {
      break;
    }
    pageNumber += 1;
  }

  return collected;
}
