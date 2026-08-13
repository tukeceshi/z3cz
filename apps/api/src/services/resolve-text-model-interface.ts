import type {
  AiModelCatalogEntry,
  AiModelModality,
  OrgTextModelOption,
  PlatformAiModel,
  SingleModelEndpointRules,
  SingleModelModelConfig,
  VolcanoArkApiKeyScope,
  VolcanoInterfaceMetadata,
  VolcanoModelConfig,
} from "@dafthunk/types";
import {
  findEnabledOrgModelInstanceByCanonicalId,
  isExternalBrandOnlyCanonicalId,
  isVolcanoAiInterfaceProvider,
  listOrgModelEntries,
  pickLegacyOrgModelInterfaceId,
  readOrgModelUpstreamId,
  resolveVolcanoInferenceModelId,
} from "@dafthunk/types";
import { parseSingleModelMetadata } from "../integrations/single-model/metadata";

import type { Database } from "../db";
import {
  getTextParameterRules,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import { listAggregateVolcanoCatalogEntries } from "../db/platform-ai-model-channel-queries";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";
import {
  buildOrgModelBindings,
  toOrgBindingInterfaces,
  type OrgBindingInterface,
} from "./build-org-model-bindings";

export interface ResolvedOrgModelInterface<TRules> {
  readonly instanceId: string;
  readonly canonicalId: string;
  readonly displayName: string;
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly channelKind: "aggregate" | "api";
  readonly providerModelId: string;
  readonly parameterRules: TRules;
}

export type ResolvedTextModelInterface = ResolvedOrgModelInterface<
  ReturnType<typeof getTextParameterRules>
>;

export type TextModelChannelKind = "aggregate" | "api";

export interface TextModelInterfaceCandidate {
  readonly instanceId: string;
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly channelKind: TextModelChannelKind;
  readonly providerModelId: string;
}

export interface VolcanoInterfaceCandidate {
  readonly id: string;
  readonly createdAt: Date;
  readonly models: Readonly<Record<string, VolcanoModelConfig>>;
  readonly arkEndpoints?: Readonly<Record<string, string>>;
  readonly arkApiKeyScope?: VolcanoArkApiKeyScope;
}

export interface SingleModelInterfaceCandidate {
  readonly id: string;
  readonly createdAt: Date;
  readonly singleModelPresetId: string;
  readonly singleModelCategory?: string;
  readonly endpointRules?: SingleModelEndpointRules;
  readonly models: Readonly<Record<string, SingleModelModelConfig>>;
}

export function buildVolcanoCatalogEntriesFromPlatformModels(
  platformModels: readonly PlatformAiModel[],
  aggregateCatalog: readonly AiModelCatalogEntry[]
): readonly AiModelCatalogEntry[] {
  const catalogById = new Map(
    aggregateCatalog.map((entry) => [entry.canonicalId, entry])
  );

  return platformModels.flatMap((model) => {
    if (isExternalBrandOnlyCanonicalId(model.canonicalId)) {
      return [];
    }
    const catalogEntry = catalogById.get(model.canonicalId);
    if (!catalogEntry) {
      return [];
    }
    return [
      {
        canonicalId: model.canonicalId,
        alias: model.displayName,
        modality: model.modality as AiModelModality,
        providerModelId: catalogEntry.providerModelId,
      },
    ];
  });
}

export async function listVolcanoCatalogEntriesFromPlatform(
  db: Database,
  platformModels: readonly PlatformAiModel[]
): Promise<readonly AiModelCatalogEntry[]> {
  const aggregateCatalog = await listAggregateVolcanoCatalogEntries(db);
  return buildVolcanoCatalogEntriesFromPlatformModels(
    platformModels,
    aggregateCatalog
  );
}

/** @deprecated Use listVolcanoCatalogEntriesFromPlatform(db, models). */
export function toVolcanoCatalogEntriesFromPlatform(
  models: readonly PlatformAiModel[],
  aggregateCatalog: readonly AiModelCatalogEntry[]
): readonly AiModelCatalogEntry[] {
  return buildVolcanoCatalogEntriesFromPlatformModels(models, aggregateCatalog);
}

export function collectVolcanoInterfaces(
  interfaces: Awaited<ReturnType<typeof listOrganizationAiInterfaces>>
): VolcanoInterfaceCandidate[] {
  return interfaces
    .filter(
      (row) => row.enabled && isVolcanoAiInterfaceProvider(row.provider)
    )
    .flatMap((row) => {
      const metadata = parseInterfaceMetadata(row.metadata);
      if (!isVolcanoMetadata(metadata)) return [];
      return [
        {
          id: row.id,
          createdAt: new Date(row.createdAt),
          models: metadata.models,
          arkEndpoints: metadata.arkEndpoints,
          arkApiKeyScope: metadata.arkApiKeyScope,
        },
      ];
    });
}

export function collectSingleModelInterfaces(
  interfaces: Awaited<ReturnType<typeof listOrganizationAiInterfaces>>
): SingleModelInterfaceCandidate[] {
  return interfaces
    .filter((row) => row.enabled && row.provider === "custom")
    .flatMap((row) => {
      const metadata = parseSingleModelMetadata(
        parseInterfaceMetadata(row.metadata)
      );
      if (!metadata) {
        return [];
      }
      return [
        {
          id: row.id,
          createdAt: new Date(row.createdAt),
          singleModelPresetId: metadata.singleModelPresetId,
          singleModelCategory: metadata.singleModelCategory,
          endpointRules: metadata.endpointRules,
          models: metadata.models,
        },
      ];
    });
}

export function collectOrgBindingInterfaces(
  interfaces: Awaited<ReturnType<typeof listOrganizationAiInterfaces>>
): OrgBindingInterface[] {
  return toOrgBindingInterfaces({
    volcanoInterfaces: collectVolcanoInterfaces(interfaces),
    singleModelInterfaces: collectSingleModelInterfaces(interfaces),
  });
}

export async function listOrgTextModelOptions(
  db: Database,
  organizationId: string
): Promise<readonly OrgTextModelOption[]> {
  const [platformModels, interfaces] = await Promise.all([
    listPlatformAiModels(db, "text"),
    listOrganizationAiInterfaces(db, organizationId),
  ]);

  return buildOrgModelBindings({
    platformModels,
    interfaces: collectOrgBindingInterfaces(interfaces),
  }).map((binding) => ({
    ...binding,
    parameterRules: getTextParameterRules(
      platformModels.find(
        (model) => model.canonicalId === binding.canonicalId
      )!
    ),
  }));
}

export interface OrgModelInterfaceBindingOption {
  readonly instanceId: string;
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly selectable: boolean;
  readonly displayName: string;
  readonly channelKind: "aggregate" | "api";
  readonly providerModelId: string;
}

export async function resolveOrgModelInterfaceBinding<TRules>(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceId: string,
  listOptions: (
    database: Database,
    orgId: string
  ) => Promise<
    readonly (OrgModelInterfaceBindingOption & {
      readonly parameterRules: TRules;
    })[]
  >,
  instanceId?: string
): Promise<ResolvedOrgModelInterface<TRules> | null> {
  const options = await listOptions(db, organizationId);
  const trimmedInstanceId = instanceId?.trim();
  const option = trimmedInstanceId
    ? options.find(
        (entry) =>
          entry.instanceId === trimmedInstanceId &&
          entry.interfaceId === interfaceId
      )
    : options.find(
        (entry) =>
          entry.canonicalId === canonicalId && entry.interfaceId === interfaceId
      );
  if (!option?.selectable) {
    return null;
  }

  const candidate = await resolveOrgModelInterfaceCandidate(
    db,
    organizationId,
    option.canonicalId,
    interfaceId,
    option.instanceId
  );
  if (!candidate) {
    return null;
  }

  return {
    instanceId: candidate.instanceId,
    canonicalId: option.canonicalId,
    displayName: option.displayName,
    interfaceId: candidate.interfaceId,
    interfaceName: candidate.interfaceName,
    channelKind: candidate.channelKind,
    providerModelId: candidate.providerModelId,
    parameterRules: option.parameterRules,
  };
}

export async function resolveOrgModelInterfaceCandidate(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceId: string,
  instanceId?: string
): Promise<TextModelInterfaceCandidate | null> {
  const interfaces = await listOrganizationAiInterfaces(db, organizationId);
  const ifaceRow = interfaces.find((row) => row.id === interfaceId);
  if (!ifaceRow?.enabled) {
    return null;
  }

  if (isVolcanoAiInterfaceProvider(ifaceRow.provider)) {
    const metadata = parseInterfaceMetadata(ifaceRow.metadata);
    if (!isVolcanoMetadata(metadata)) {
      return null;
    }
    const entries = listOrgModelEntries(metadata.models);
    const trimmedInstanceId = instanceId?.trim();
    const found = trimmedInstanceId
      ? entries.find((entry) => entry.instanceId === trimmedInstanceId)
      : findEnabledOrgModelInstanceByCanonicalId(entries, canonicalId);
    if (!found?.config.enabled) {
      return null;
    }
    const metaProviderModelId = readOrgModelUpstreamId(found.config);
    if (!metaProviderModelId) {
      return null;
    }
    return {
      instanceId: found.instanceId,
      interfaceId: ifaceRow.id,
      interfaceName: ifaceRow.name,
      channelKind: "aggregate",
      providerModelId: resolveVolcanoInferenceModelId({
        canonicalId: found.canonicalId,
        providerModelId: metaProviderModelId,
        metadata: {
          arkEndpoints: metadata.arkEndpoints,
          arkApiKeyScope: metadata.arkApiKeyScope,
        },
      }),
    };
  }

  if (ifaceRow.provider === "custom") {
    const metadata = parseSingleModelMetadata(
      parseInterfaceMetadata(ifaceRow.metadata)
    );
    if (!metadata) {
      return null;
    }
    const entries = listOrgModelEntries(metadata.models);
    const trimmedInstanceId = instanceId?.trim();
    const found = trimmedInstanceId
      ? entries.find((entry) => entry.instanceId === trimmedInstanceId)
      : findEnabledOrgModelInstanceByCanonicalId(entries, canonicalId);
    if (!found?.config.enabled) {
      return null;
    }
    const upstreamModelId = found.config.upstreamModelId.trim();
    if (!upstreamModelId) {
      return null;
    }
    return {
      instanceId: found.instanceId,
      interfaceId: ifaceRow.id,
      interfaceName: ifaceRow.name,
      channelKind: "api",
      providerModelId: upstreamModelId,
    };
  }

  return null;
}

export async function inferOrgModelInterfaceId(
  db: Database,
  organizationId: string,
  canonicalId: string,
  listOptions: (
    database: Database,
    orgId: string
  ) => Promise<readonly OrgModelInterfaceBindingOption[]>
): Promise<string | undefined> {
  const options = await listOptions(db, organizationId);
  return pickLegacyOrgModelInterfaceId(options, canonicalId);
}

export async function resolveTextModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceId: string,
  instanceId?: string
): Promise<ResolvedTextModelInterface | null> {
  return resolveOrgModelInterfaceBinding(
    db,
    organizationId,
    canonicalId,
    interfaceId,
    listOrgTextModelOptions,
    instanceId
  );
}

/**
 * Ensure volcano metadata includes all platform catalog keys.
 * Seeds providerModelId only for missing keys — never overwrites org-configured upstream IDs.
 */
export function ensureVolcanoModelsIncludePlatformCatalog(
  metadata: VolcanoInterfaceMetadata,
  platformCatalog: readonly AiModelCatalogEntry[]
): VolcanoInterfaceMetadata {
  if (platformCatalog.length === 0) {
    return metadata;
  }

  const models = { ...metadata.models };
  for (const entry of platformCatalog) {
    const existing = models[entry.canonicalId];
    if (existing) {
      if (existing.modality !== entry.modality) {
        models[entry.canonicalId] = {
          ...existing,
          modality: entry.modality,
        };
      }
      continue;
    }
    models[entry.canonicalId] = {
      enabled: false,
      canonicalId: entry.canonicalId,
      upstreamModelId: entry.providerModelId,
      modality: entry.modality,
    };
  }

  return { ...metadata, models };
}
