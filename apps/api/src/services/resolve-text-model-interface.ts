import type {
  AiModelCatalogEntry,
  AiModelModality,
  OrgTextModelOption,
  OrgTextModelUnavailableReason,
  PlatformAiModel,
  SingleModelModelConfig,
  VolcanoArkApiKeyScope,
  VolcanoInterfaceMetadata,
  VolcanoModelConfig,
} from "@dafthunk/types";
import {
  isExternalBrandOnlyCanonicalId,
  isVolcanoAiInterfaceProvider,
  resolveVolcanoInferenceModelId,
} from "@dafthunk/types";
import {
  parseSingleModelMetadata,
} from "../integrations/single-model/metadata";

import type { Database } from "../db";
import {
  getTextParameterRules,
  listModelInterfacePriorities,
  listPlatformAiModelGroups,
  listPlatformAiModels,
} from "../db/platform-ai-model-queries";
import { listOrganizationAiInterfaces } from "../db/ai-interface-queries";
import {
  isVolcanoMetadata,
  parseInterfaceMetadata,
} from "../integrations/volcengine/metadata";

export interface ResolvedTextModelInterface {
  readonly canonicalId: string;
  readonly displayName: string;
  readonly interfaceId: string;
  readonly interfaceName: string;
  readonly providerModelId: string;
  readonly parameterRules: ReturnType<typeof getTextParameterRules>;
}

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

export function sortInterfacesByPriority(
  interfaceIds: readonly string[],
  candidates: readonly { id: string; createdAt: Date }[]
): { id: string; createdAt: Date }[] {
  if (interfaceIds.length === 0) {
    return [...candidates].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  const rank = new Map(interfaceIds.map((id, index) => [id, index]));
  return [...candidates].sort((a, b) => {
    const rankA = rank.get(a.id);
    const rankB = rank.get(b.id);
    if (rankA !== undefined && rankB !== undefined) {
      return rankA - rankB;
    }
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function evaluateOrgTextModelAvailability(
  canonicalId: string,
  volcanoInterfaces: readonly VolcanoInterfaceCandidate[],
  singleModelInterfaces: readonly SingleModelInterfaceCandidate[] = []
): {
  readonly selectable: boolean;
  readonly unavailableReason?: OrgTextModelUnavailableReason;
} {
  if (volcanoInterfaces.length === 0 && singleModelInterfaces.length === 0) {
    return { selectable: false, unavailableReason: "no_org_interface" };
  }

  const enabledOnAny =
    volcanoInterfaces.some(
      (entry) => entry.models[canonicalId]?.enabled === true
    ) ||
    singleModelInterfaces.some(
      (entry) => entry.models[canonicalId]?.enabled === true
    );
  if (enabledOnAny) {
    return { selectable: true };
  }

  const keyPresentOnAny =
    volcanoInterfaces.some(
      (entry) => entry.models[canonicalId] !== undefined
    ) ||
    singleModelInterfaces.some(
      (entry) => entry.models[canonicalId] !== undefined
    );
  if (!keyPresentOnAny) {
    return {
      selectable: false,
      unavailableReason: "model_missing_on_interface",
    };
  }

  return {
    selectable: false,
    unavailableReason: "model_disabled_on_interface",
  };
}

export function toVolcanoCatalogEntriesFromPlatform(
  models: readonly PlatformAiModel[]
): readonly AiModelCatalogEntry[] {
  return models
    .filter((model) => !isExternalBrandOnlyCanonicalId(model.canonicalId))
    .map((model) => ({
      canonicalId: model.canonicalId,
      alias: model.displayName,
      modality: model.modality,
      providerModelId: model.providerModelId,
    }));
}

function collectVolcanoInterfaces(
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
  const [platformModels, groups, interfaces] = await Promise.all([
    listPlatformAiModels(db, "text"),
    listPlatformAiModelGroups(db),
    listOrganizationAiInterfaces(db, organizationId),
  ]);

  const groupById = new Map(groups.map((group) => [group.id, group]));
  const visibleModels = platformModels.filter((model) => model.platformEnabled);
  const volcanoInterfaces = collectVolcanoInterfaces(interfaces);
  const singleModelInterfaces = collectSingleModelInterfaces(interfaces);

  return visibleModels.map((model) => {
    const availability = evaluateOrgTextModelAvailability(
      model.canonicalId,
      volcanoInterfaces,
      singleModelInterfaces
    );
    const group = model.groupId ? groupById.get(model.groupId) : undefined;

    return {
      canonicalId: model.canonicalId,
      displayName: model.displayName,
      modality: model.modality as AiModelModality,
      providerModelId: model.providerModelId,
      parameterRules: getTextParameterRules(model),
      selectable: availability.selectable,
      unavailableReason: availability.unavailableReason,
      description: model.description,
      groupId: model.groupId,
      groupName: group?.name ?? null,
      groupDescription: group?.description ?? null,
      groupIcon: group?.icon ?? null,
    };
  });
}

export async function listTextModelInterfaceCandidates(
  db: Database,
  organizationId: string,
  canonicalId: string
): Promise<readonly TextModelInterfaceCandidate[]> {
  const options = await listOrgTextModelOptions(db, organizationId);
  const option = options.find((entry) => entry.canonicalId === canonicalId);
  if (!option?.selectable) {
    return [];
  }

  const [interfaces, priorities] = await Promise.all([
    listOrganizationAiInterfaces(db, organizationId),
    listModelInterfacePriorities(db, organizationId),
  ]);

  const priorityIds =
    priorities.find((entry) => entry.canonicalId === canonicalId)
      ?.interfaceIds ?? [];

  const volcanoInterfaces = collectVolcanoInterfaces(interfaces);
  const singleModelInterfaces = collectSingleModelInterfaces(interfaces);

  const volcanoCandidates = volcanoInterfaces
    .filter((entry) => entry.models[canonicalId]?.enabled === true)
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      volcano: entry,
    }));

  const directCandidates = singleModelInterfaces
    .filter((entry) => entry.models[canonicalId]?.enabled === true)
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      upstreamModelId: entry.models[canonicalId]!.upstreamModelId,
    }));

  const sorted = sortInterfacesByPriority(priorityIds, [
    ...volcanoCandidates,
    ...directCandidates,
  ]);

  return sorted.flatMap((entry) => {
    const directMatch = directCandidates.find(
      (candidate) => candidate.id === entry.id
    );
    if (directMatch) {
      const ifaceRow = interfaces.find((row) => row.id === entry.id);
      if (!ifaceRow) {
        return [];
      }
      return [
        {
          interfaceId: ifaceRow.id,
          interfaceName: ifaceRow.name,
          channelKind: "api" as const,
          providerModelId: directMatch.upstreamModelId,
        },
      ];
    }

    const volcanoMatch = volcanoCandidates.find(
      (candidate) => candidate.id === entry.id
    );
    if (!volcanoMatch) {
      return [];
    }

    const ifaceRow = interfaces.find((row) => row.id === entry.id);
    if (!ifaceRow) {
      return [];
    }

    return [
      {
        interfaceId: ifaceRow.id,
        interfaceName: ifaceRow.name,
        channelKind: "aggregate" as const,
        providerModelId: resolveVolcanoInferenceModelId({
          canonicalId,
          providerModelId: option.providerModelId,
          metadata: {
            arkEndpoints: volcanoMatch.volcano.arkEndpoints,
            arkApiKeyScope: volcanoMatch.volcano.arkApiKeyScope,
          },
        }),
      },
    ];
  });
}

export async function resolveTextModelInterface(
  db: Database,
  organizationId: string,
  canonicalId: string
): Promise<ResolvedTextModelInterface | null> {
  const options = await listOrgTextModelOptions(db, organizationId);
  const option = options.find((entry) => entry.canonicalId === canonicalId);
  if (!option?.selectable) return null;

  const candidates = await listTextModelInterfaceCandidates(
    db,
    organizationId,
    canonicalId
  );
  const first = candidates[0];
  if (!first) {
    return null;
  }

  return {
    canonicalId,
    displayName: option.displayName,
    interfaceId: first.interfaceId,
    interfaceName: first.interfaceName,
    providerModelId: first.providerModelId,
    parameterRules: option.parameterRules,
  };
}

/** Ensure volcano metadata includes all platform catalog keys and sync providerModelIds. */
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
      if (
        existing.providerModelId !== entry.providerModelId ||
        existing.modality !== entry.modality
      ) {
        models[entry.canonicalId] = {
          ...existing,
          providerModelId: entry.providerModelId,
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
