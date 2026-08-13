import {
  VOLCANO_AGGREGATE_MODEL_CATALOG,
  readOrgModelUpstreamId,
  type AiModelCatalogEntry,
  type VolcanoArkApiKeyScope,
  type VolcanoInterfaceMetadata,
} from "@dafthunk/types";

import { callVolcengineArkApi, type VolcengineCredentials } from "./client";
import { VOLCANO_DEFAULT_PROJECT_NAME } from "./constants";
import { listVolcanoEndpointIds, readEndpointId } from "./list-endpoints";
import { parseVolcanoFoundationModelReference } from "./parse-foundation-model-reference";

function endpointNameForModel(canonicalId: string): string {
  return `dafthunk-${canonicalId}`.slice(0, 64);
}

function providerModelIdFromFoundationReference(
  name: string,
  version: string
): string {
  return `${name}-${version}`;
}

function catalogByCanonicalId(
  catalog: readonly AiModelCatalogEntry[] = VOLCANO_AGGREGATE_MODEL_CATALOG
): Map<string, AiModelCatalogEntry> {
  return new Map(catalog.map((entry) => [entry.canonicalId, entry]));
}

function resolveUpstreamModelId(params: {
  readonly canonicalId: string;
  readonly config: VolcanoInterfaceMetadata["models"][string];
  readonly catalog: Map<string, AiModelCatalogEntry>;
}): string {
  return (
    readOrgModelUpstreamId(params.config) ||
    params.catalog.get(params.canonicalId)?.providerModelId ||
    ""
  );
}

/** Sync modality from catalog only — never overwrite org-configured upstream IDs. */
function syncModelFromCatalog(
  canonicalId: string,
  config: VolcanoInterfaceMetadata["models"][string],
  catalog: Map<string, AiModelCatalogEntry>
): VolcanoInterfaceMetadata["models"][string] {
  const catalogEntry = catalog.get(canonicalId);
  if (!catalogEntry) {
    return config;
  }

  if (config.modality === catalogEntry.modality) {
    return config;
  }

  return {
    ...config,
    modality: catalogEntry.modality,
  };
}

async function createVolcanoEndpoint(params: {
  readonly credentials: VolcengineCredentials;
  readonly canonicalId: string;
  readonly providerModelId: string;
}): Promise<string | null> {
  const reference = parseVolcanoFoundationModelReference(params.providerModelId);
  if (!reference) {
    return null;
  }

  try {
    const result = await callVolcengineArkApi<Record<string, unknown>>({
      credentials: params.credentials,
      action: "CreateEndpoint",
      body: {
        Name: endpointNameForModel(params.canonicalId),
        ProjectName: VOLCANO_DEFAULT_PROJECT_NAME,
        ModelReference: {
          FoundationModel: {
            Name: reference.name,
            ModelVersion: reference.version,
          },
        },
      },
    });

    return readEndpointId(result);
  } catch {
    return null;
  }
}

function readFoundationModelFromEndpoint(
  endpoint: Record<string, unknown>
): { readonly name: string; readonly version: string } | null {
  const modelReference = endpoint.ModelReference;
  if (!modelReference || typeof modelReference !== "object") {
    return null;
  }

  const foundationModel = (modelReference as Record<string, unknown>)
    .FoundationModel;
  if (!foundationModel || typeof foundationModel !== "object") {
    return null;
  }

  const name = (foundationModel as Record<string, unknown>).Name;
  const version = (foundationModel as Record<string, unknown>).ModelVersion;
  if (typeof name !== "string" || typeof version !== "string") {
    return null;
  }

  return { name, version };
}

function canonicalIdForProviderModelId(
  providerModelId: string,
  catalog: Map<string, AiModelCatalogEntry>
): string | null {
  for (const entry of catalog.values()) {
    if (entry.providerModelId === providerModelId) {
      return entry.canonicalId;
    }
  }
  return null;
}

async function reconcileListedEndpoints(params: {
  readonly credentials: VolcengineCredentials;
  readonly arkEndpoints: Readonly<Record<string, string>>;
  readonly catalog: Map<string, AiModelCatalogEntry>;
}): Promise<{ readonly arkEndpoints: Record<string, string>; readonly changed: boolean }> {
  const endpointIds = await listVolcanoEndpointIds(params.credentials);
  if (endpointIds.length === 0) {
    return { arkEndpoints: { ...params.arkEndpoints }, changed: false };
  }

  const arkEndpoints = { ...params.arkEndpoints };
  let changed = false;

  for (const endpointId of endpointIds) {
    try {
      const endpoint = await callVolcengineArkApi<Record<string, unknown>>({
        credentials: params.credentials,
        action: "GetEndpoint",
        body: { Id: endpointId },
      });
      const foundation = readFoundationModelFromEndpoint(endpoint);
      if (!foundation) {
        continue;
      }

      const providerModelId = providerModelIdFromFoundationReference(
        foundation.name,
        foundation.version
      );
      const canonicalId = canonicalIdForProviderModelId(
        providerModelId,
        params.catalog
      );
      if (!canonicalId || arkEndpoints[canonicalId] === endpointId) {
        continue;
      }

      arkEndpoints[canonicalId] = endpointId;
      changed = true;
    } catch {
      continue;
    }
  }

  return { arkEndpoints, changed };
}

export async function ensureVolcanoModelEndpoints(params: {
  readonly credentials: VolcengineCredentials;
  readonly metadata: VolcanoInterfaceMetadata;
  readonly catalog?: readonly AiModelCatalogEntry[];
  readonly canonicalIds?: readonly string[];
}): Promise<{
  readonly metadata: VolcanoInterfaceMetadata;
  readonly endpointIds: readonly string[];
  readonly changed: boolean;
}> {
  const catalog = catalogByCanonicalId(params.catalog);
  let models = { ...params.metadata.models };
  let changed = false;

  for (const [canonicalId, config] of Object.entries(models)) {
    const synced = syncModelFromCatalog(canonicalId, config, catalog);
    if (synced !== config) {
      models = { ...models, [canonicalId]: synced };
      changed = true;
    }
  }

  let arkEndpoints = { ...(params.metadata.arkEndpoints ?? {}) };

  const reconciled = await reconcileListedEndpoints({
    credentials: params.credentials,
    arkEndpoints,
    catalog,
  });
  if (reconciled.changed) {
    arkEndpoints = reconciled.arkEndpoints;
    changed = true;
  }

  const targetCanonicalIds =
    params.canonicalIds ??
    Object.entries(models)
      .filter(([, config]) => config.enabled)
      .map(([canonicalId]) => canonicalId);

  for (const canonicalId of targetCanonicalIds) {
    const config = models[canonicalId];
    if (!config?.enabled || arkEndpoints[canonicalId]) {
      continue;
    }

    const upstreamModelId = resolveUpstreamModelId({
      canonicalId,
      config,
      catalog,
    });
    const syncedConfig =
      upstreamModelId === readOrgModelUpstreamId(config)
        ? config
        : { ...config, upstreamModelId };

    if (syncedConfig !== config) {
      models = { ...models, [canonicalId]: syncedConfig };
      changed = true;
    }

    const endpointId = await createVolcanoEndpoint({
      credentials: params.credentials,
      canonicalId,
      providerModelId: upstreamModelId,
    });

    if (!endpointId) {
      continue;
    }

    arkEndpoints = { ...arkEndpoints, [canonicalId]: endpointId };
    changed = true;
  }

  const endpointIds = [...new Set(Object.values(arkEndpoints))];
  const metadata = changed
    ? { ...params.metadata, models, arkEndpoints }
    : params.metadata;

  if (endpointIds.length === 0) {
    const listed = await listVolcanoEndpointIds(params.credentials);
    return { metadata, endpointIds: listed, changed };
  }

  return { metadata, endpointIds, changed };
}

export function applyVolcanoArkKeyScope(params: {
  readonly metadata: VolcanoInterfaceMetadata;
  readonly scope: VolcanoArkApiKeyScope;
}): VolcanoInterfaceMetadata {
  if (params.metadata.arkApiKeyScope === params.scope) {
    return params.metadata;
  }
  return { ...params.metadata, arkApiKeyScope: params.scope };
}
