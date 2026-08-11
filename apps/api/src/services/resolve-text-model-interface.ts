import type {
  AiModelCatalogEntry,
  AiModelModality,
  OrgTextModelOption,
  PlatformAiModel,
  SingleModelModelConfig,
  VolcanoArkApiKeyScope,
  VolcanoInterfaceMetadata,
  VolcanoModelConfig,
} from "@dafthunk/types";
import {
  isExternalBrandOnlyCanonicalId,
  isVolcanoAiInterfaceProvider,
  pickLegacyOrgModelInterfaceId,
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
import { buildOrgModelBindings } from "./build-org-model-bindings";

export interface ResolvedOrgModelInterface<TRules> {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly providerModelId: string;
  readonly parameterRules: TRules;
}

export type ResolvedTextModelInterface = ResolvedOrgModelInterface<
  ReturnType<typeof getTextParameterRules>
>;

export type TextModelChannelKind = "aggregate" | "api";

export interface TextModelInterfaceCandidate {
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
          models: metadata.models,
        },
      ];
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

  const volcanoInterfaces = collectVolcanoInterfaces(interfaces);
  const singleModelInterfaces = collectSingleModelInterfaces(interfaces);

  return buildOrgModelBindings({
    platformModels,
    volcanoInterfaces,
    singleModelInterfaces,
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
  readonly canonicalId: string;
  readonly interfaceId: string;
  readonly selectable: boolean;
  readonly displayName: string;
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
  >
): Promise<ResolvedOrgModelInterface<TRules> | null> {
  const options = await listOptions(db, organizationId);
  const option = options.find(
    (entry) =>
      entry.canonicalId === canonicalId && entry.interfaceId === interfaceId
  );
  if (!option?.selectable) {
    return null;
  }

  const candidate = await resolveOrgModelInterfaceCandidate(
    db,
    organizationId,
    canonicalId,
    interfaceId
  );
  if (!candidate) {
    return null;
  }

  return {
    canonicalId,
    displayName: option.displayName,
    interfaceId: candidate.interfaceId,
    interfaceName: candidate.interfaceName,
    providerModelId: candidate.providerModelId,
    parameterRules: option.parameterRules,
  };
}

export async function resolveOrgModelInterfaceCandidate(
  db: Database,
  organizationId: string,
  canonicalId: string,
  interfaceId: string
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
    const config = metadata.models[canonicalId];
    if (!config?.enabled) {
      return null;
    }
    const metaProviderModelId = config.providerModelId?.trim();
    if (!metaProviderModelId) {
      return null;
    }
    return {
      interfaceId: ifaceRow.id,
      interfaceName: ifaceRow.name,
      channelKind: "aggregate",
      providerModelId: resolveVolcanoInferenceModelId({
        canonicalId,
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
    const config = metadata.models[canonicalId];
    if (!config?.enabled) {
      return null;
    }
    const upstreamModelId = config.upstreamModelId?.trim();
    if (!upstreamModelId) {
      return null;
    }
    return {
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
  interfaceId: string
): Promise<ResolvedTextModelInterface | null> {
  return resolveOrgModelInterfaceBinding(
    db,
    organizationId,
    canonicalId,
    interfaceId,
    listOrgTextModelOptions
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
      providerModelId: entry.providerModelId,
      modality: entry.modality,
    };
  }

  return { ...metadata, models };
}
